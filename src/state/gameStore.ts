import { bossForRealm } from '../content/bosses'
import { allocationRemainsConnected, canAllocateNode, prunePending } from '../content/skillTree'
import {
  applyEquip,
  applyUnequip,
  applyKill,
  deriveStats,
  getRealm,
  huntIndex,
  levelFromTotalXp,
  pickMonster,
  spawnMonster,
  strikeDamage,
} from '../game'
import { grantBossVictory, wardenAwaits, type RealmDoor } from '../game/boss'
import { claimHunt, claimable, dueElite, noteKill, withHunt } from '../game/contracts'
import { spawnBoss } from '../game/combat'
import {
  DOT_MS,
  attackScale,
  auraDps,
  avoided,
  foeName,
  hitDots,
  isEnraged,
  leechHeal,
  monsterSwingLimit,
  suppressRegen,
  thornsDamage,
} from '../game/fight'
import { migratePlayer } from '../game/migrate'
import { ascendItem as ascendItemCraft, rerollItemMod as rerollItemModCraft, temperItem as temperItemCraft } from '../game/craft'
import type { CraftOutcome } from '../game/craft'
import { salvageScrap } from '../game/salvage'
import { essenceName } from '../content/essences'
import { BOSS_FAIL_MS, START_NODE_ID, TICK_MS } from '../game/types'
import { DEATH_COOLDOWN_MS, DESPAWN_MS, PLAYER_SWING_MS } from '../game/types'
import { mulberry32, hashSeed } from '../game/rng'
import type {
  CombatLogEntry,
  CombatSnapshot,
  DerivedStats,
  EquipSlot,
  FloatingHit,
  Item,
  OfflineGrant,
  PlayerState,
} from '../game/types'
import { confirmHuntSeal } from '../lib/huntSeal'
import { persistSave } from '../lib/persist'
import { create } from 'zustand'

type ScreenId = 'combat' | 'character' | 'inventory' | 'skills'

const unseenKey = (playerId: string) => `idle-relic-expedition:unseen:${playerId}`

function readUnseen(playerId: string): string[] {
  try {
    const raw = localStorage.getItem(unseenKey(playerId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

function writeUnseen(playerId: string, ids: string[]): void {
  localStorage.setItem(unseenKey(playerId), JSON.stringify(ids))
}

function mergeUnseen(playerId: string, current: string[], added: string[], validIds: Set<string>): string[] {
  const next = [...new Set([...current, ...added])].filter((id) => validIds.has(id))
  writeUnseen(playerId, next)
  return next
}

type GameStore = {
  ready: boolean
  paused: boolean
  dirty: boolean
  screen: ScreenId
  player: PlayerState | null
  items: Item[]
  stats: DerivedStats | null
  combat: CombatSnapshot | null
  monsterIndex: number
  queuedMonsterIndex: number
  selectedItemId: string | null
  unseenItemIds: string[]
  pendingNodeIds: number[]
  pendingRemovalNodeIds: number[]
  realmPickerOpen: boolean
  offlineGrant: OfflineGrant | null
  huntsOpen: boolean
  huntNotices: { id: string; title: string }[]
  realmDoor: RealmDoor | null
  bossFled: boolean
  error: string | null
  hydrate: (player: PlayerState, items: Item[], knownItemIds?: string[]) => void
  setScreen: (screen: ScreenId) => void
  selectItem: (id: string | null) => void
  queueMonster: (index: number) => void
  tick: (dt?: number) => void
  equip: (itemId: string, slot: EquipSlot) => void
  unequip: (itemId: string) => void
  salvage: (itemIds: string[]) => void
  temperItem: (itemId: string) => { ok: true; success: boolean } | { ok: false; reason: string }
  rerollItemMod: (
    itemId: string,
    kind: 'prefix' | 'suffix',
    index: number,
  ) => { ok: true; success: boolean } | { ok: false; reason: string }
  ascendItem: (keeperId: string, fodderIds: string[]) => { ok: true; item: Item } | { ok: false; reason: string }
  queueNode: (nodeId: number) => void
  confirmNodes: () => void
  discardNodes: () => void
  openRealmPicker: () => void
  closeRealmPicker: () => void
  selectRealm: (realmId: number) => void
  openHunts: () => void
  closeHunts: () => void
  claimContract: (
    id: string,
  ) => { ok: true; boardSealed: boolean; rewardText: string } | { ok: false; reason: string }
  challengeBoss: () => void
  resumeBoss: (awayMs: number) => boolean
  acknowledgeDoor: () => void
  acknowledgeBossFled: () => void
  acknowledgeOffline: () => void
  markClean: () => void
  setPaused: (paused: boolean) => void
  persistNow: () => Promise<void>
}

let logSeq = 1
let floatSeq = 1

function pushLog(log: CombatLogEntry[], text: string, rarity?: CombatLogEntry['rarity']): CombatLogEntry[] {
  return [...log, { id: logSeq++, text, rarity }].slice(-18)
}

function pushFloat(floats: FloatingHit[], text: string, kind: FloatingHit['kind']): FloatingHit[] {
  return [...floats, { id: floatSeq++, text, kind }].slice(-8)
}

function applyCraft(
  get: () => GameStore,
  set: (partial: Partial<GameStore>) => void,
  itemId: string,
  run: (player: PlayerState, item: Item) => CraftOutcome,
): CraftOutcome {
  const { player, items, combat } = get()
  const item = items.find((entry) => entry.id === itemId)
  if (!player || !item) return { ok: false, reason: 'That relic is gone.' }
  const outcome = run(player, item)
  if (!outcome.ok) return outcome
  const nextItems = items.map((entry) => (entry.id === itemId ? outcome.item : entry))
  const stats = deriveStats(outcome.player, nextItems)
  set({
    player: outcome.player,
    items: nextItems,
    stats,
    dirty: true,
    combat: combat
      ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) }
      : combat,
  })
  return outcome
}

function rebuildCombat(
  player: PlayerState,
  stats: DerivedStats,
  monsterIndex: number,
  previous?: CombatSnapshot | null,
): CombatSnapshot {
  const realm = getRealm(player.realmId)
  const def = pickMonster(realm, monsterIndex)
  const keepHp = previous ? Math.min(previous.playerHp, stats.hp) : stats.hp
  return {
    monster: spawnMonster(def, dueElite(player)),
    playerHp: previous?.deathCooldownMs ? 0 : keepHp,
    playerMaxHp: stats.hp,
    playerSwing: 0,
    monsterSwing: 0,
    deathCooldownMs: previous?.deathCooldownMs ?? 0,
    despawnMs: 0,
    encounter: (previous?.encounter ?? 0) + 1,
    log: previous?.log ?? [],
    floats: [],
    bossTimeLeftMs: 0,
    bossPauseMs: 0,
    bossFailed: false,
    ambushReady: true,
    enraged: false,
    burnMs: 0,
    burnDps: 0,
    poisonMs: 0,
    poisonDps: 0,
    dotBuffer: 0,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  ready: false,
  paused: true,
  dirty: false,
  screen: 'combat',
  player: null,
  items: [],
  stats: null,
  combat: null,
  monsterIndex: 0,
  queuedMonsterIndex: 0,
  selectedItemId: null,
  unseenItemIds: [],
  pendingNodeIds: [],
  pendingRemovalNodeIds: [],
  realmPickerOpen: false,
  offlineGrant: null,
  huntsOpen: false,
  huntNotices: [],
  realmDoor: null,
  bossFled: false,
  error: null,

  hydrate: (player, items, knownItemIds) => {
    const synced = migratePlayer({
      ...player,
      level: levelFromTotalXp(player.xp),
      highestRealmId: Math.max(player.highestRealmId ?? 1, player.realmId),
    })
    const stats = deriveStats(synced, items)
    const realm = getRealm(synced.realmId)
    const monsterIndex = huntIndex(realm, synced.monsterIndex)
    const queuedMonsterIndex = huntIndex(realm, synced.queuedMonsterIndex)
    const resumed = { ...synced, monsterIndex, queuedMonsterIndex }
    const bagIds = new Set(items.filter((item) => !item.equippedSlot).map((item) => item.id))
    const known = new Set(knownItemIds ?? get().items.map((item) => item.id))
    const stored = readUnseen(resumed.id)
    const fresh = items.filter((item) => !item.equippedSlot && !known.has(item.id)).map((item) => item.id)
    const unseenItemIds = mergeUnseen(resumed.id, stored, fresh, bagIds)
    set({
      ready: true,
      paused: false,
      player: resumed,
      items,
      stats,
      combat: rebuildCombat(resumed, stats, monsterIndex),
      monsterIndex,
      queuedMonsterIndex,
      unseenItemIds,
      pendingNodeIds: [],
      pendingRemovalNodeIds: [],
      huntNotices: claimable(resumed.hunt).map((contract) => ({ id: contract.id, title: contract.title })),
      dirty: false,
    })
    if (resumed.hunt.unconfirmedSealBoard != null) void confirmPendingHuntSeal()
  },

  setScreen: (screen) => {
    const { screen: previous, player, unseenItemIds } = get()
    if (previous === 'inventory' && screen !== 'inventory' && player && unseenItemIds.length > 0) {
      writeUnseen(player.id, [])
      set({ screen, unseenItemIds: [] })
      return
    }
    set({ screen })
  },
  selectItem: (id) => {
    const { player, unseenItemIds } = get()
    if (!id || !player || !unseenItemIds.includes(id)) {
      set({ selectedItemId: id })
      return
    }
    const nextUnseen = unseenItemIds.filter((itemId) => itemId !== id)
    writeUnseen(player.id, nextUnseen)
    set({ selectedItemId: id, unseenItemIds: nextUnseen })
  },
  setPaused: (paused) => set({ paused }),
  markClean: () => set({ dirty: false }),
  acknowledgeOffline: () => set({ offlineGrant: null, bossFled: false }),

  queueMonster: (index) => {
    const { player, combat } = get()
    if (!player) return
    if (combat?.monster.boss && combat.monster.hp > 0 && combat.bossPauseMs === 0 && combat.deathCooldownMs === 0) return
    const realm = getRealm(player.realmId)
    const nextIndex = huntIndex(realm, index)
    set({
      queuedMonsterIndex: nextIndex,
      player: { ...player, queuedMonsterIndex: nextIndex },
      dirty: true,
    })
  },

  tick: (dt = TICK_MS) => {
    const { paused, player, items, combat, stats, monsterIndex, queuedMonsterIndex } = get()
    if (paused || !player || !combat || !stats) return

    let nextPlayer = withHunt(player)
    let nextItems = items
    let nextStats = stats
    let nextMonsterIndex = monsterIndex
    let dirty = nextPlayer !== player
    let nextUnseen = get().unseenItemIds
    let huntNotices = get().huntNotices
    let realmDoor = get().realmDoor

    if (combat.deathCooldownMs > 0) {
      const remaining = Math.max(0, combat.deathCooldownMs - dt)
      const revived = remaining === 0
      let nextCombat = {
        ...combat,
        deathCooldownMs: remaining,
        playerHp: revived ? stats.hp : 0,
        playerMaxHp: stats.hp,
        playerSwing: 0,
        monsterSwing: 0,
        bossFailed: revived ? false : combat.bossFailed,
        log: combat.log,
        floats: combat.floats.slice(-6),
      }
      if (revived && queuedMonsterIndex !== monsterIndex) {
        nextMonsterIndex = queuedMonsterIndex
        nextCombat = rebuildCombat(player, stats, nextMonsterIndex, {
          ...nextCombat,
          playerHp: stats.hp,
          deathCooldownMs: 0,
          bossFailed: false,
        })
      }
      set({
        player: nextMonsterIndex === monsterIndex ? player : { ...player, monsterIndex: nextMonsterIndex },
        combat: nextCombat,
        monsterIndex: nextMonsterIndex,
        dirty: get().dirty || nextMonsterIndex !== monsterIndex,
      })
      return
    }

    if (combat.bossPauseMs > 0) {
      const remaining = Math.max(0, combat.bossPauseMs - dt)
      if (remaining > 0) {
        set({ combat: { ...combat, bossPauseMs: remaining } })
        return
      }
      const spawnedIndex = queuedMonsterIndex
      const indexChanged = spawnedIndex !== player.monsterIndex
      set({
        player: indexChanged ? { ...player, monsterIndex: spawnedIndex } : player,
        combat: rebuildCombat(player, stats, spawnedIndex, { ...combat, bossPauseMs: 0 }),
        monsterIndex: spawnedIndex,
        dirty: get().dirty || indexChanged,
      })
      return
    }

    if (combat.despawnMs > 0) {
      const remaining = Math.max(0, combat.despawnMs - dt)
      if (remaining > 0) {
        set({ combat: { ...combat, despawnMs: remaining } })
        return
      }
      const spawnedIndex = queuedMonsterIndex
      const spawned = {
        ...rebuildCombat(player, stats, spawnedIndex, { ...combat, despawnMs: 0 }),
        playerSwing: Math.min(PLAYER_SWING_MS - 1, DESPAWN_MS),
      }
      const indexChanged = spawnedIndex !== player.monsterIndex
      set({
        player: indexChanged ? { ...player, monsterIndex: spawnedIndex } : player,
        combat: spawned,
        monsterIndex: spawnedIndex,
        dirty: get().dirty || indexChanged,
      })
      return
    }

    if (combat.monster.boss && combat.monster.hp > 0 && combat.bossTimeLeftMs - dt <= 0) {
      set({
        combat: {
          ...combat,
          bossTimeLeftMs: 0,
          bossPauseMs: BOSS_FAIL_MS,
          log: pushLog(combat.log, `${foeName(combat.monster)} outlasts you.`),
        },
      })
      return
    }

    let nextCombat: CombatSnapshot = {
      ...combat,
      playerSwing: combat.playerSwing + dt,
      monsterSwing: combat.monsterSwing + dt,
      floats: combat.floats.slice(-6),
      playerMaxHp: stats.hp,
      bossTimeLeftMs: combat.monster.boss ? Math.max(0, combat.bossTimeLeftMs - dt) : 0,
    }
    const suppress = suppressRegen(nextCombat.monster)
    if (nextCombat.playerHp > 0 && nextCombat.playerHp < nextStats.hp && suppress < 1) {
      nextCombat.playerHp = Math.min(
        nextStats.hp,
        nextCombat.playerHp + nextStats.hpRegen * (1 - suppress) * (dt / 1000),
      )
    }
    const regen = nextCombat.monster.def.trait.regen ?? 0
    if (regen > 0 && nextCombat.monster.hp > 0 && nextCombat.monster.hp < nextCombat.monster.maxHp) {
      nextCombat = {
        ...nextCombat,
        monster: {
          ...nextCombat.monster,
          hp: Math.min(nextCombat.monster.maxHp, nextCombat.monster.hp + nextCombat.monster.maxHp * regen * (dt / 1000)),
        },
      }
    }
    let dotBuffer = nextCombat.dotBuffer
    const burnMs = Math.max(0, nextCombat.burnMs - dt)
    const poisonMs = Math.max(0, nextCombat.poisonMs - dt)
    if (nextCombat.burnMs > 0) dotBuffer += nextCombat.burnDps * (dt / 1000)
    if (nextCombat.poisonMs > 0) dotBuffer += nextCombat.poisonDps * (dt / 1000)
    const burningAura = auraDps(nextCombat.monster)
    if (burningAura > 0 && nextCombat.monster.hp > 0) dotBuffer += burningAura * (dt / 1000)
    const dotHit = Math.floor(dotBuffer)
    nextCombat = {
      ...nextCombat,
      dotBuffer: dotBuffer - dotHit,
      burnMs,
      poisonMs,
      burnDps: burnMs > 0 ? nextCombat.burnDps : 0,
      poisonDps: poisonMs > 0 ? nextCombat.poisonDps : 0,
    }
    const downed = (snapshot: CombatSnapshot, wasBoss: boolean): CombatSnapshot => {
      nextMonsterIndex = queuedMonsterIndex
      const spawned = rebuildCombat(nextPlayer, nextStats, nextMonsterIndex, {
        ...snapshot,
        deathCooldownMs: DEATH_COOLDOWN_MS,
      })
      return {
        ...spawned,
        playerHp: 0,
        deathCooldownMs: DEATH_COOLDOWN_MS,
        bossFailed: wasBoss,
        log: snapshot.log,
        floats: snapshot.floats,
      }
    }
    if (dotHit > 0 && nextCombat.playerHp > 0) {
      const beforeHp = nextCombat.playerHp
      nextCombat.playerHp = Math.max(0, nextCombat.playerHp - dotHit)
      if (beforeHp > nextCombat.playerHp) {
        nextCombat.floats = pushFloat(nextCombat.floats, `${dotHit}`, 'monster')
      }
    }
    const rng = mulberry32(hashSeed(`${player.id}:${player.xp}:${Math.floor(combat.monster.hp)}:${Date.now()}`))
    const markEnrage = () => {
      if (!nextCombat.enraged && isEnraged(nextCombat.monster)) {
        nextCombat = {
          ...nextCombat,
          enraged: true,
          log: pushLog(nextCombat.log, `${foeName(nextCombat.monster)} is enraged.`),
        }
      }
    }

    if (nextCombat.playerHp > 0 && nextCombat.playerSwing >= PLAYER_SWING_MS && nextCombat.monster.hp > 0) {
      nextCombat.playerSwing = 0
      const dodge = avoided(nextCombat.monster, rng)
      if (dodge) {
        nextCombat.floats = pushFloat(nextCombat.floats, dodge === 'guard' ? 'GUARD' : 'PHASE', 'block')
      } else {
        const hit = strikeDamage(
          nextStats.attack,
          nextCombat.monster.def.defense,
          nextStats.critChance,
          nextStats.critMulti,
          rng,
        )
        const hp = Math.max(0, nextCombat.monster.hp - hit.damage)
        nextCombat = {
          ...nextCombat,
          monster: { ...nextCombat.monster, hp },
          floats: pushFloat(nextCombat.floats, `${hit.damage}${hit.crit ? '!' : ''}`, hit.crit ? 'crit' : 'player'),
        }
        const stealRate = nextStats.lifeSteal * (1 - suppress)
        const steal = stealRate > 0 && nextCombat.playerHp > 0 ? Math.max(1, Math.round(hit.damage * stealRate)) : 0
        if (steal > 0) {
          const beforeHp = nextCombat.playerHp
          nextCombat.playerHp = Math.min(nextStats.hp, nextCombat.playerHp + steal)
          const gained = nextCombat.playerHp - beforeHp
          if (gained > 0) nextCombat.floats = pushFloat(nextCombat.floats, `+${Math.round(gained)}`, 'heal')
        }
        markEnrage()
        if (hp <= 0) {
          const slain = nextCombat.monster
          const result = applyKill(nextPlayer, nextItems, slain, nextStats, rng)
          const noted = noteKill(result.player, {
            monsterId: slain.def.id,
            realmId: nextPlayer.realmId,
            elite: slain.elite,
            boss: slain.boss,
          })
          nextPlayer = noted.player
          if (slain.boss) {
            const victory = grantBossVictory(nextPlayer)
            nextPlayer = victory.player
            realmDoor = victory.door
          }
          nextItems = result.items
          nextStats = deriveStats(nextPlayer, nextItems)
          dirty = true
          let killLog = nextCombat.log
          if (slain.elite || slain.boss) killLog = pushLog(killLog, `${foeName(slain)} falls`)
          if (result.reward.item) killLog = pushLog(killLog, result.reward.item.name, result.reward.item.rarity)
          if (result.reward.essenceId) killLog = pushLog(killLog, `+1 ${essenceName(result.reward.essenceId)}`)
          for (const contract of noted.fulfilled) {
            killLog = pushLog(killLog, `Hunt fulfilled — ${contract.title}`)
            if (!huntNotices.some((notice) => notice.id === contract.id)) {
              huntNotices = [...huntNotices, { id: contract.id, title: contract.title }]
            }
          }
          nextCombat = {
            ...nextCombat,
            monster: { ...slain, hp: 0 },
            despawnMs: DESPAWN_MS,
            log: killLog,
          }
          if (result.reward.item) {
            const bagIds = new Set(nextItems.filter((item) => !item.equippedSlot).map((item) => item.id))
            nextUnseen = mergeUnseen(nextPlayer.id, nextUnseen, [result.reward.item.id], bagIds)
          }
        } else {
          const reflected = thornsDamage(nextCombat.monster, hit.damage)
          if (reflected > 0 && nextCombat.playerHp > 0) {
            nextCombat.playerHp = Math.max(0, nextCombat.playerHp - reflected)
            nextCombat.floats = pushFloat(nextCombat.floats, `${reflected}`, 'monster')
          }
        }
      }
    }

    if (nextCombat.playerHp <= 0) {
      nextCombat = downed(nextCombat, combat.monster.boss)
    } else if (nextCombat.monster.hp > 0 && nextCombat.monsterSwing >= monsterSwingLimit(nextCombat.monster)) {
      nextCombat.monsterSwing = 0
      if (rng() < nextStats.block) {
        nextCombat.floats = pushFloat(nextCombat.floats, 'BLOCK', 'block')
      } else {
        const scaled = attackScale(nextCombat.monster, nextCombat.ambushReady)
        const hit = strikeDamage(nextCombat.monster.def.attack, nextStats.defense, 0.05, 1.4, rng)
        const damage = Math.max(1, Math.floor(hit.damage * scaled.scale))
        const beforeHp = nextCombat.playerHp
        const hp = Math.max(0, nextCombat.playerHp - damage)
        const healed = leechHeal(nextCombat.monster, damage)
        const dots = hitDots(nextCombat.monster)
        nextCombat = {
          ...nextCombat,
          ambushReady: scaled.ambushReady,
          playerHp: hp,
          burnMs: dots.burn > 0 ? DOT_MS : nextCombat.burnMs,
          burnDps: dots.burn > 0 ? dots.burn : nextCombat.burnDps,
          poisonMs: dots.poison > 0 ? DOT_MS : nextCombat.poisonMs,
          poisonDps: dots.poison > 0 ? dots.poison : nextCombat.poisonDps,
          monster: healed
            ? {
                ...nextCombat.monster,
                hp: Math.min(nextCombat.monster.maxHp, nextCombat.monster.hp + healed),
              }
            : nextCombat.monster,
          floats: beforeHp > hp ? pushFloat(nextCombat.floats, `${damage}`, 'monster') : nextCombat.floats,
        }
        if (hp <= 0) nextCombat = downed(nextCombat, combat.monster.boss)
      }
    }

    if (nextMonsterIndex !== nextPlayer.monsterIndex) {
      nextPlayer = { ...nextPlayer, monsterIndex: nextMonsterIndex }
      dirty = true
    }
    set({
      player: nextPlayer,
      items: nextItems,
      stats: nextStats,
      combat: nextCombat,
      monsterIndex: nextMonsterIndex,
      unseenItemIds: nextUnseen,
      huntNotices,
      realmDoor,
      dirty: get().dirty || dirty,
    })
  },

  equip: (itemId, slot) => {
    const { items, player, combat } = get()
    if (!player) return
    const nextItems = applyEquip(items, itemId, slot)
    if (nextItems === items) return
    const stats = deriveStats(player, nextItems)
    set({
      items: nextItems,
      stats,
      dirty: true,
      combat: combat ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) } : combat,
    })
  },

  temperItem: (itemId) => {
    const outcome = applyCraft(get, set, itemId, (player, item) => temperItemCraft(player, item, Math.random))
    return outcome.ok ? { ok: true, success: outcome.success } : outcome
  },

  rerollItemMod: (itemId, kind, index) => {
    const outcome = applyCraft(get, set, itemId, (player, item) =>
      rerollItemModCraft(player, item, kind, index, Math.random),
    )
    return outcome.ok ? { ok: true, success: outcome.success } : outcome
  },

  ascendItem: (keeperId, fodderIds) => {
    const { items, player, combat, unseenItemIds } = get()
    if (!player) return { ok: false, reason: 'That relic is gone.' }
    const keeper = items.find((item) => item.id === keeperId)
    if (!keeper) return { ok: false, reason: 'That relic is gone.' }
    const fodder: Item[] = []
    for (const id of fodderIds) {
      const item = items.find((entry) => entry.id === id)
      if (!item) return { ok: false, reason: 'A sacrifice is missing.' }
      fodder.push(item)
    }
    const outcome = ascendItemCraft(keeper, fodder, Math.random)
    if (!outcome.ok) return outcome
    const remove = new Set(fodderIds)
    const nextItems = items
      .filter((item) => !remove.has(item.id))
      .map((item) => (item.id === keeperId ? outcome.item : item))
    const stats = deriveStats(player, nextItems)
    const bagIds = new Set(nextItems.filter((item) => !item.equippedSlot).map((item) => item.id))
    set({
      items: nextItems,
      stats,
      unseenItemIds: mergeUnseen(player.id, unseenItemIds, [], bagIds),
      selectedItemId: keeperId,
      dirty: true,
      combat: combat
        ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) }
        : combat,
    })
    return outcome
  },

  salvage: (itemIds) => {
    const { items, player, selectedItemId, unseenItemIds } = get()
    if (!player || itemIds.length === 0) return
    const chosen = new Set(itemIds)
    let scrap = 0
    const nextItems = items.filter((item) => {
      if (!chosen.has(item.id) || item.equippedSlot || item.locked) return true
      scrap += salvageScrap(item)
      return false
    })
    if (nextItems.length === items.length) return
    const bagIds = new Set(nextItems.filter((item) => !item.equippedSlot).map((item) => item.id))
    const nextUnseen = mergeUnseen(player.id, unseenItemIds, [], bagIds)
    set({
      items: nextItems,
      player: { ...player, scrap: player.scrap + scrap },
      selectedItemId: selectedItemId && chosen.has(selectedItemId) ? null : selectedItemId,
      unseenItemIds: nextUnseen,
      dirty: true,
    })
  },

  unequip: (itemId) => {
    const { items, player, combat } = get()
    if (!player) return
    const nextItems = applyUnequip(items, itemId)
    const stats = deriveStats(player, nextItems)
    set({
      items: nextItems,
      stats,
      dirty: true,
      combat: combat ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) } : combat,
    })
  },

  queueNode: (nodeId) => {
    const { player, pendingNodeIds, pendingRemovalNodeIds } = get()
    if (!player) return
    if (player.allocatedNodeIds.includes(nodeId)) {
      if (pendingNodeIds.length > 0) {
        set({ error: 'Confirm or discard pending allocations before refunding nodes.' })
        return
      }
      if (nodeId === START_NODE_ID) {
        set({ error: 'The starting node cannot be refunded.' })
        return
      }
      const removing = pendingRemovalNodeIds.includes(nodeId)
        ? pendingRemovalNodeIds.filter((id) => id !== nodeId)
        : [...pendingRemovalNodeIds, nodeId]
      if (!allocationRemainsConnected(player.allocatedNodeIds, removing)) {
        set({ error: removing.includes(nodeId) ? 'Unassign outer nodes first.' : 'Restore inner nodes first.' })
        return
      }
      set({ pendingRemovalNodeIds: removing, error: null })
      return
    }
    if (pendingRemovalNodeIds.length > 0) {
      set({ error: 'Confirm or discard pending refunds before allocating nodes.' })
      return
    }
    if (pendingNodeIds.includes(nodeId)) {
      set({ pendingNodeIds: prunePending(player.allocatedNodeIds, pendingNodeIds, nodeId), error: null })
      return
    }
    const check = canAllocateNode(nodeId, player.allocatedNodeIds, player.skillPointsUnspent, pendingNodeIds)
    if (!check.ok) {
      set({ error: check.reason })
      return
    }
    set({ pendingNodeIds: [...pendingNodeIds, nodeId], error: null })
  },

  confirmNodes: () => {
    const { player, items, pendingNodeIds, pendingRemovalNodeIds, combat } = get()
    if (!player || (pendingNodeIds.length === 0 && pendingRemovalNodeIds.length === 0)) return
    if (pendingRemovalNodeIds.length > 0) {
      const goldCost = pendingRemovalNodeIds.length * player.level * 2
      if (player.gold < goldCost) {
        set({ error: `Unassigning these nodes costs ${goldCost.toLocaleString()} gold.` })
        return
      }
      const removed = new Set(pendingRemovalNodeIds)
      const nextPlayer = {
        ...player,
        gold: player.gold - goldCost,
        skillPointsUnspent: player.skillPointsUnspent + pendingRemovalNodeIds.length,
        allocatedNodeIds: player.allocatedNodeIds.filter((id) => !removed.has(id)),
      }
      const stats = deriveStats(nextPlayer, items)
      set({
        player: nextPlayer,
        stats,
        pendingRemovalNodeIds: [],
        dirty: true,
        error: null,
        combat: combat
          ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) }
          : combat,
      })
      return
    }
    if (pendingNodeIds.length > player.skillPointsUnspent) {
      set({ error: 'Not enough skill points.' })
      return
    }
    const nextPlayer = {
      ...player,
      skillPointsUnspent: player.skillPointsUnspent - pendingNodeIds.length,
      allocatedNodeIds: [...player.allocatedNodeIds, ...pendingNodeIds],
    }
    const stats = deriveStats(nextPlayer, items)
    set({
      player: nextPlayer,
      stats,
      pendingNodeIds: [],
      pendingRemovalNodeIds: [],
      dirty: true,
      error: null,
      combat: combat
        ? { ...combat, playerMaxHp: stats.hp, playerHp: Math.min(combat.playerHp, stats.hp) }
        : combat,
    })
  },

  discardNodes: () => {
    set({ pendingNodeIds: [], pendingRemovalNodeIds: [], error: null })
  },

  openRealmPicker: () => {
    const { combat } = get()
    if (combat?.monster.boss && combat.monster.hp > 0 && combat.bossPauseMs === 0 && combat.deathCooldownMs === 0) return
    set({ realmPickerOpen: true })
  },
  closeRealmPicker: () => set({ realmPickerOpen: false }),

  selectRealm: (realmId) => {
    const { player, items, combat } = get()
    if (!player) return
    if (combat?.monster.boss && combat.monster.hp > 0 && combat.bossPauseMs === 0 && combat.deathCooldownMs === 0) return
    if (realmId > player.highestRealmId) return
    if (realmId === player.realmId) {
      set({ realmPickerOpen: false })
      return
    }
    let realmProgress = player.realmProgress
    let progressRealmId = player.progressRealmId
    if (realmId === player.highestRealmId && progressRealmId !== realmId) {
      realmProgress = 0
      progressRealmId = realmId
    }
    const nextPlayer = { ...player, realmId, realmProgress, progressRealmId, monsterIndex: 0, queuedMonsterIndex: 0 }
    const stats = deriveStats(nextPlayer, items)
    set({
      player: nextPlayer,
      stats,
      monsterIndex: 0,
      queuedMonsterIndex: 0,
      realmPickerOpen: false,
      combat: rebuildCombat(nextPlayer, stats, 0, combat),
      dirty: true,
    })
  },

  openHunts: () => set({ huntsOpen: true, huntNotices: [] }),
  closeHunts: () => set({ huntsOpen: false }),

  claimContract: (id) => {
    const { player, huntNotices } = get()
    if (!player) return { ok: false, reason: 'Not ready.' }
    const outcome = claimHunt(player, id)
    if (!outcome.ok) return outcome
    set({
      player: outcome.player,
      huntNotices: huntNotices.filter((notice) => notice.id !== id),
      dirty: true,
    })
    if (outcome.boardSealed) void confirmPendingHuntSeal()
    return { ok: true, boardSealed: outcome.boardSealed, rewardText: outcome.rewardText }
  },

  challengeBoss: () => {
    const { player, stats, combat } = get()
    if (!player || !stats || !combat || !wardenAwaits(player)) return
    if (combat.monster.boss && combat.monster.hp > 0) return
    const boss = bossForRealm(player.realmId)
    if (!boss) return
    set({
      screen: 'combat',
      combat: {
        ...combat,
        monster: spawnBoss(boss),
        playerHp: stats.hp,
        playerMaxHp: stats.hp,
        playerSwing: 0,
        monsterSwing: 0,
        deathCooldownMs: 0,
        despawnMs: 0,
        encounter: combat.encounter + 1,
        bossTimeLeftMs: boss.timeLimitMs,
        bossPauseMs: 0,
        bossFailed: false,
        ambushReady: true,
        enraged: false,
        burnMs: 0,
        burnDps: 0,
        poisonMs: 0,
        poisonDps: 0,
        dotBuffer: 0,
        floats: [],
        log: pushLog(combat.log, `${boss.name} answers.`),
      },
    })
  },

  resumeBoss: (awayMs) => {
    const { combat } = get()
    const live =
      !!combat?.monster.boss && combat.monster.hp > 0 && combat.deathCooldownMs === 0 && combat.bossPauseMs === 0
    if (!live || !combat) return false
    if (awayMs >= 8_000) return false
    const left = combat.bossTimeLeftMs - awayMs
    if (left <= 0) {
      set({
        paused: false,
        combat: {
          ...combat,
          bossTimeLeftMs: 0,
          bossPauseMs: BOSS_FAIL_MS,
          log: pushLog(combat.log, `${foeName(combat.monster)} outlasts you.`),
        },
      })
      return true
    }
    set({ paused: false, combat: { ...combat, bossTimeLeftMs: left } })
    return true
  },

  acknowledgeDoor: () => set({ realmDoor: null }),
  acknowledgeBossFled: () => set({ bossFled: false }),

  persistNow: async () => {
    const { player, items } = get()
    if (!player) return
    const stamped = { ...player, lastSettledAt: Date.now() }
    await persistSave(stamped, items)
    set({ player: stamped, dirty: false })
  },
}))

async function confirmPendingHuntSeal(): Promise<void> {
  const { player, items } = useGameStore.getState()
  if (!player || player.hunt.unconfirmedSealBoard == null) return
  const sealed =
    player.hunt.unconfirmedSealBoard === player.hunt.board &&
    player.hunt.contracts.length === 3 &&
    player.hunt.contracts.every((contract) => contract.claimed)
  if (!sealed) {
    useGameStore.setState({
      player: { ...player, hunt: { ...player.hunt, unconfirmedSealBoard: null } },
      dirty: true,
    })
    return
  }
  try {
    const diamonds = await confirmHuntSeal(player, items)
    const current = useGameStore.getState().player
    if (!current || current.hunt.unconfirmedSealBoard == null) return
    if (diamonds == null) {
      useGameStore.setState({
        player: { ...current, hunt: { ...current.hunt, unconfirmedSealBoard: null } },
        dirty: true,
      })
      return
    }
    useGameStore.setState({
      player: {
        ...current,
        diamonds,
        hunt: { ...current.hunt, unconfirmedSealBoard: null },
      },
      dirty: true,
    })
  } catch (error) {
    console.error(error)
  }
}
