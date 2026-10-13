import { essenceName, essencesInRealm } from '../content/essences'
import { getRealm } from './combat'
import { hashSeed, mulberry32 } from './rng'
import type { DerivedStats, HuntContract, HuntKind, HuntState, PlayerState } from './types'

export type KillNote = {
  monsterId: string
  realmId: number
  elite: boolean
  boss: boolean
}

export const HUNT_BOARD_COOLDOWN_MS = 2 * 60 * 60 * 1000
export const HUNT_SEAL_DIAMONDS = 3

function optionalTime(value: unknown): number | null {
  const time = Number(value)
  if (!Number.isFinite(time) || time <= 0) return null
  return Math.floor(time)
}

function optionalBoard(value: unknown): number | null {
  const board = Math.floor(Number(value))
  if (!Number.isFinite(board) || board <= 0) return null
  return board
}

function isContract(value: unknown): value is HuntContract {
  if (!value || typeof value !== 'object') return false
  const row = value as HuntContract
  return (
    typeof row.id === 'string' &&
    (row.kind === 'monster' || row.kind === 'elite' || row.kind === 'realm') &&
    typeof row.title === 'string' &&
    typeof row.detail === 'string' &&
    typeof row.target === 'number' &&
    typeof row.progress === 'number' &&
    typeof row.claimed === 'boolean' &&
    !!row.reward &&
    typeof row.reward.gold === 'number'
  )
}

export function huntFromUnknown(value: unknown): HuntState | undefined {
  if (!value || typeof value !== 'object') return undefined
  const raw = value as Partial<HuntState>
  const contracts = Array.isArray(raw.contracts) ? raw.contracts.filter(isContract) : []
  return {
    killsTowardElite: Math.max(0, Math.floor(Number(raw.killsTowardElite ?? 0)) || 0),
    suppressElite: Boolean(raw.suppressElite),
    board: Math.max(1, Math.floor(Number(raw.board ?? 1)) || 1),
    finalBossCleared: Boolean(raw.finalBossCleared),
    contracts,
    nextBoardAt: optionalTime(raw.nextBoardAt),
    diamondRewardBoard: optionalBoard(raw.diamondRewardBoard),
    unconfirmedSealBoard: optionalBoard(raw.unconfirmedSealBoard),
  }
}

function pickIndex(rng: () => number, count: number): number {
  if (count <= 1) return 0
  return Math.floor(rng() * count)
}

function quarryNumbers(realmId: number, kind: HuntKind): { target: number; gold: number; scrap: number; essence: number } {
  if (kind === 'elite') return { target: 6 + realmId * 2, gold: 400 * realmId, scrap: 18 * realmId, essence: 9 }
  if (kind === 'realm') return { target: 60 + realmId * 24, gold: 300 * realmId, scrap: 15 * realmId, essence: 6 }
  return { target: 48 + realmId * 20, gold: 260 * realmId, scrap: 12 * realmId, essence: 6 }
}

function quarryDetail(contract: Pick<HuntContract, 'kind' | 'title'>, target: number): string {
  if (contract.kind === 'elite') return `Slay ${target} elites`
  if (contract.kind === 'realm') return `Slay ${target} foes in ${contract.title}`
  return `Slay ${target} ${contract.title}`
}

function scaleOpenContract(contract: HuntContract): HuntContract {
  if (contract.claimed) return contract
  const numbers = quarryNumbers(contract.realmId, contract.kind)
  const detail = quarryDetail(contract, numbers.target)
  if (
    contract.target === numbers.target &&
    contract.detail === detail &&
    contract.reward.gold === numbers.gold &&
    contract.reward.scrap === numbers.scrap &&
    contract.reward.essence === numbers.essence
  ) {
    return contract
  }
  return {
    ...contract,
    target: numbers.target,
    detail,
    progress: Math.min(contract.progress, numbers.target),
    reward: {
      ...contract.reward,
      gold: numbers.gold,
      scrap: numbers.scrap,
      essence: numbers.essence,
    },
  }
}

function scaleOpenContracts(hunt: HuntState): HuntState {
  let changed = false
  const contracts = hunt.contracts.map((contract) => {
    const next = scaleOpenContract(contract)
    if (next !== contract) changed = true
    return next
  })
  return changed ? { ...hunt, contracts } : hunt
}

export function rollBoard(playerId: string, realmId: number, board: number): HuntContract[] {
  const realm = getRealm(realmId)
  const rng = mulberry32(hashSeed(`${playerId}:hunts:${board}`))
  const monsters = realm.monsters
  const monster = monsters[pickIndex(rng, monsters.length)] ?? monsters[0]
  const essencePool = essencesInRealm(realm.id)
  const essenceFor = (fallback: string) => essencePool[pickIndex(rng, essencePool.length)]?.id ?? fallback
  const monsterNumbers = quarryNumbers(realm.id, 'monster')
  const eliteNumbers = quarryNumbers(realm.id, 'elite')
  const realmNumbers = quarryNumbers(realm.id, 'realm')
  const monsterEssence = monster?.id ?? essenceFor('dust-mite')
  const eliteEssence = essenceFor(monsterEssence)
  const realmEssence = essenceFor(monsterEssence)

  const slay: HuntContract = {
    id: `${board}:monster`,
    kind: 'monster',
    title: monster?.name ?? 'Foes',
    detail: quarryDetail({ kind: 'monster', title: monster?.name ?? 'Foes' }, monsterNumbers.target),
    monsterId: monster?.id ?? null,
    realmId: realm.id,
    target: monsterNumbers.target,
    progress: 0,
    claimed: false,
    reward: {
      gold: monsterNumbers.gold,
      scrap: monsterNumbers.scrap,
      essenceId: monsterEssence,
      essence: monsterNumbers.essence,
    },
  }
  const elites: HuntContract = {
    id: `${board}:elite`,
    kind: 'elite',
    title: 'Elites',
    detail: quarryDetail({ kind: 'elite', title: 'Elites' }, eliteNumbers.target),
    monsterId: null,
    realmId: realm.id,
    target: eliteNumbers.target,
    progress: 0,
    claimed: false,
    reward: {
      gold: eliteNumbers.gold,
      scrap: eliteNumbers.scrap,
      essenceId: eliteEssence,
      essence: eliteNumbers.essence,
    },
  }
  const sweep: HuntContract = {
    id: `${board}:realm`,
    kind: 'realm',
    title: realm.name,
    detail: quarryDetail({ kind: 'realm', title: realm.name }, realmNumbers.target),
    monsterId: null,
    realmId: realm.id,
    target: realmNumbers.target,
    progress: 0,
    claimed: false,
    reward: {
      gold: realmNumbers.gold,
      scrap: realmNumbers.scrap,
      essenceId: realmEssence,
      essence: realmNumbers.essence,
    },
  }
  return [slay, elites, sweep]
}

function boardCooling(hunt: HuntState, now: number): boolean {
  return hunt.nextBoardAt != null && now < hunt.nextBoardAt
}

function resolveBoard(player: PlayerState, hunt: HuntState, now: number): HuntState {
  const scaled = scaleOpenContracts(hunt)
  const sealed = scaled.contracts.length === 3 && scaled.contracts.every((contract) => contract.claimed)
  const diamondsWaiting = scaled.diamondRewardBoard != null || scaled.unconfirmedSealBoard != null
  if (sealed && (boardCooling(scaled, now) || diamondsWaiting)) return scaled
  if (sealed && scaled.nextBoardAt != null) {
    const board = scaled.board + 1
    return {
      ...scaled,
      board,
      nextBoardAt: null,
      diamondRewardBoard: null,
      unconfirmedSealBoard: null,
      contracts: rollBoard(player.id, player.realmId, board),
    }
  }
  if (scaled.contracts.length === 3) return scaled
  if (boardCooling(scaled, now)) return scaled
  const board = scaled.board || 1
  return {
    ...scaled,
    board,
    nextBoardAt: null,
    contracts: rollBoard(player.id, player.realmId, board),
  }
}

export function withHunt(player: PlayerState, hunt?: HuntState, now = Date.now()): PlayerState {
  const current = hunt ?? player.hunt
  const next = resolveBoard(player, current, now)
  if (next === current) return hunt === undefined ? player : { ...player, hunt: current }
  return { ...player, hunt: next }
}

export function suppressNextElite(player: PlayerState): PlayerState {
  if (player.hunt.suppressElite) return player
  return { ...player, hunt: { ...player.hunt, suppressElite: true } }
}

/** Rolls the next non-boss elite. A pending loss clears the flag and forces a normal foe. */
export function consumeEliteSpawn(
  player: PlayerState,
  chance: number,
  rng: () => number,
): { player: PlayerState; elite: boolean } {
  if (player.hunt.suppressElite) {
    return {
      elite: false,
      player: { ...player, hunt: { ...player.hunt, suppressElite: false } },
    }
  }
  const odds = Math.min(1, Math.max(0, chance))
  return { player, elite: rng() < odds }
}

export function eliteSpawnChance(stats: Pick<DerivedStats, 'eliteChance'>): number {
  return Math.min(1, Math.max(0, stats.eliteChance))
}

export function noteKill(
  player: PlayerState,
  note: KillNote,
  now = Date.now(),
): { player: PlayerState; fulfilled: HuntContract[] } {
  const ready = withHunt(player, undefined, now)
  const hunt = ready.hunt
  const killsTowardElite = note.boss ? hunt.killsTowardElite : note.elite ? 0 : hunt.killsTowardElite + 1
  const fulfilled: HuntContract[] = []
  const contracts = hunt.contracts.map((contract) => {
    if (contract.claimed || contract.progress >= contract.target) return contract
    const counts =
      (contract.kind === 'monster' && contract.monsterId === note.monsterId) ||
      (contract.kind === 'elite' && note.elite) ||
      (contract.kind === 'realm' && contract.realmId === note.realmId)
    if (!counts) return contract
    const progress = Math.min(contract.target, contract.progress + 1)
    const next = { ...contract, progress }
    if (progress >= contract.target) fulfilled.push(next)
    return next
  })
  return {
    player: { ...ready, hunt: { ...hunt, killsTowardElite, contracts } },
    fulfilled,
  }
}

export function rewardLine(contract: HuntContract): string {
  return `+${contract.reward.gold} gold · +${contract.reward.scrap} scrap · +${contract.reward.essence} ${essenceName(contract.reward.essenceId)}`
}

export function claimHunt(
  player: PlayerState,
  contractId: string,
  now = Date.now(),
): { ok: true; player: PlayerState; boardSealed: boolean; rewardText: string } | { ok: false; reason: string } {
  const ready = withHunt(player, undefined, now)
  const contract = ready.hunt.contracts.find((entry) => entry.id === contractId)
  if (!contract) return { ok: false, reason: 'That hunt is gone.' }
  if (contract.claimed) return { ok: false, reason: 'Already sealed.' }
  if (contract.progress < contract.target) return { ok: false, reason: 'The hunt is still open.' }
  if (ready.hunt.nextBoardAt != null && now < ready.hunt.nextBoardAt) {
    return { ok: false, reason: 'The board is sealed. New hunts are not posted yet.' }
  }
  const contracts = ready.hunt.contracts.map((entry) =>
    entry.id === contractId ? { ...entry, claimed: true } : entry,
  )
  const boardSealed = contracts.every((entry) => entry.claimed)
  const essences = { ...ready.essences }
  essences[contract.reward.essenceId] = (essences[contract.reward.essenceId] ?? 0) + contract.reward.essence
  return {
    ok: true,
    boardSealed,
    rewardText: rewardLine(contract),
    player: {
      ...ready,
      gold: ready.gold + contract.reward.gold,
      scrap: ready.scrap + contract.reward.scrap,
      essences,
      hunt: {
        ...ready.hunt,
        contracts,
        nextBoardAt: boardSealed ? now + HUNT_BOARD_COOLDOWN_MS : ready.hunt.nextBoardAt,
        diamondRewardBoard: boardSealed ? ready.hunt.board : ready.hunt.diamondRewardBoard,
      },
    },
  }
}

export function claimSealDiamonds(
  player: PlayerState,
): { ok: true; player: PlayerState; rewardText: string } | { ok: false; reason: string } {
  const hunt = player.hunt
  const sealed = hunt.contracts.length === 3 && hunt.contracts.every((contract) => contract.claimed)
  if (!sealed) return { ok: false, reason: 'Seal every hunt first.' }
  if (hunt.diamondRewardBoard == null) return { ok: false, reason: 'The diamonds are already claimed.' }
  return {
    ok: true,
    rewardText: `+${HUNT_SEAL_DIAMONDS} diamonds`,
    player: {
      ...player,
      diamonds: player.diamonds + HUNT_SEAL_DIAMONDS,
      hunt: {
        ...hunt,
        diamondRewardBoard: null,
        unconfirmedSealBoard: hunt.board,
      },
    },
  }
}

export function claimable(hunt: HuntState): HuntContract[] {
  return hunt.contracts.filter((contract) => !contract.claimed && contract.progress >= contract.target)
}
