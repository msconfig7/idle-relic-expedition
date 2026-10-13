import { essenceName, essencesInRealm } from '../content/essences'
import { realms } from '../content/realms'
import { getRealm } from './combat'
import { ELITE_EVERY } from './types'
import { hashSeed, mulberry32 } from './rng'
import type { HuntContract, HuntKind, HuntState, PlayerState, RealmDef } from './types'

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

function quarryDetail(contract: Pick<HuntContract, 'kind' | 'title' | 'realmId'>, target: number): string {
  const realmName = getRealm(contract.realmId).name
  if (contract.kind === 'elite') return `Slay ${target} elites in ${realmName}`
  if (contract.kind === 'realm') return `Slay ${target} foes in ${contract.title}`
  return `Slay ${target} ${contract.title} in ${realmName}`
}

function enabledRealms(highestRealmId: number): RealmDef[] {
  const cap = Math.max(1, Math.floor(highestRealmId) || 1)
  const open = realms.filter((realm) => realm.id <= cap)
  return open.length > 0 ? open : realms.slice(0, 1)
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

function rollKind(kind: HuntKind, realm: RealmDef, board: number, rng: () => number): HuntContract {
  const numbers = quarryNumbers(realm.id, kind)
  const essencePool = essencesInRealm(realm.id)
  const essenceFor = (fallback: string) => essencePool[pickIndex(rng, essencePool.length)]?.id ?? fallback

  if (kind === 'monster') {
    const monsters = realm.monsters
    const monster = monsters[pickIndex(rng, monsters.length)] ?? monsters[0]
    const title = monster?.name ?? 'Foes'
    return {
      id: `${board}:monster`,
      kind,
      title,
      detail: quarryDetail({ kind, title, realmId: realm.id }, numbers.target),
      monsterId: monster?.id ?? null,
      realmId: realm.id,
      target: numbers.target,
      progress: 0,
      claimed: false,
      reward: {
        gold: numbers.gold,
        scrap: numbers.scrap,
        essenceId: monster?.id ?? essenceFor('dust-mite'),
        essence: numbers.essence,
      },
    }
  }

  if (kind === 'elite') {
    return {
      id: `${board}:elite`,
      kind,
      title: 'Elites',
      detail: quarryDetail({ kind, title: 'Elites', realmId: realm.id }, numbers.target),
      monsterId: null,
      realmId: realm.id,
      target: numbers.target,
      progress: 0,
      claimed: false,
      reward: {
        gold: numbers.gold,
        scrap: numbers.scrap,
        essenceId: essenceFor(realm.monsters[0]?.id ?? 'dust-mite'),
        essence: numbers.essence,
      },
    }
  }

  return {
    id: `${board}:realm`,
    kind: 'realm',
    title: realm.name,
    detail: quarryDetail({ kind: 'realm', title: realm.name, realmId: realm.id }, numbers.target),
    monsterId: null,
    realmId: realm.id,
    target: numbers.target,
    progress: 0,
    claimed: false,
    reward: {
      gold: numbers.gold,
      scrap: numbers.scrap,
      essenceId: essenceFor(realm.monsters[0]?.id ?? 'dust-mite'),
      essence: numbers.essence,
    },
  }
}

export function rollBoard(playerId: string, highestRealmId: number, board: number): HuntContract[] {
  const pool = enabledRealms(highestRealmId)
  const rng = mulberry32(hashSeed(`${playerId}:hunts:${board}`))
  const pickRealm = () => pool[pickIndex(rng, pool.length)] ?? pool[0]
  return (['monster', 'elite', 'realm'] as const).map((kind) => rollKind(kind, pickRealm(), board, rng))
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
      contracts: rollBoard(player.id, player.highestRealmId ?? player.realmId, board),
    }
  }
  if (scaled.contracts.length === 3) return scaled
  if (boardCooling(scaled, now)) return scaled
  const board = scaled.board || 1
  return {
    ...scaled,
    board,
    nextBoardAt: null,
    contracts: rollBoard(player.id, player.highestRealmId ?? player.realmId, board),
  }
}

export function withHunt(player: PlayerState, hunt?: HuntState, now = Date.now()): PlayerState {
  const current = hunt ?? player.hunt
  const next = resolveBoard(player, current, now)
  if (next === current) return hunt === undefined ? player : { ...player, hunt: current }
  return { ...player, hunt: next }
}

export function dueElite(player: PlayerState): boolean {
  return player.hunt.killsTowardElite >= ELITE_EVERY
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
      (contract.kind === 'elite' && note.elite && contract.realmId === note.realmId) ||
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
