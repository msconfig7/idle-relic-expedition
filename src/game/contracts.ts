import { essenceName, essencesInRealm } from '../content/essences'
import { getRealm } from './combat'
import { ELITE_EVERY } from './types'
import { hashSeed, mulberry32 } from './rng'
import type { HuntContract, HuntState, PlayerState } from './types'

export type KillNote = {
  monsterId: string
  realmId: number
  elite: boolean
  boss: boolean
}

const emptyHunt = (): HuntState => ({
  killsTowardElite: 0,
  board: 1,
  finalBossCleared: false,
  contracts: [],
})

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
  }
}

function pickIndex(rng: () => number, count: number): number {
  if (count <= 1) return 0
  return Math.floor(rng() * count)
}

export function rollBoard(playerId: string, realmId: number, board: number): HuntContract[] {
  const realm = getRealm(realmId)
  const rng = mulberry32(hashSeed(`${playerId}:hunts:${board}`))
  const monsters = realm.monsters
  const monster = monsters[pickIndex(rng, monsters.length)] ?? monsters[0]
  const essencePool = essencesInRealm(realm.id)
  const essenceFor = (fallback: string) => essencePool[pickIndex(rng, essencePool.length)]?.id ?? fallback
  const monsterTarget = 18 + realm.id * 8
  const eliteTarget = 2 + Math.floor(realm.id / 2)
  const realmTarget = 24 + realm.id * 10
  const monsterEssence = monster?.id ?? essenceFor('dust-mite')
  const eliteEssence = essenceFor(monsterEssence)
  const realmEssence = essenceFor(monsterEssence)

  const slay: HuntContract = {
    id: `${board}:monster`,
    kind: 'monster',
    title: monster?.name ?? 'Foes',
    detail: `Slay ${monsterTarget} ${monster?.name ?? 'foes'}`,
    monsterId: monster?.id ?? null,
    realmId: realm.id,
    target: monsterTarget,
    progress: 0,
    claimed: false,
    reward: { gold: 80 * realm.id, scrap: 4 * realm.id, essenceId: monsterEssence, essence: 2 },
  }
  const elites: HuntContract = {
    id: `${board}:elite`,
    kind: 'elite',
    title: 'Elites',
    detail: `Slay ${eliteTarget} elites`,
    monsterId: null,
    realmId: realm.id,
    target: eliteTarget,
    progress: 0,
    claimed: false,
    reward: { gold: 120 * realm.id, scrap: 6 * realm.id, essenceId: eliteEssence, essence: 3 },
  }
  const sweep: HuntContract = {
    id: `${board}:realm`,
    kind: 'realm',
    title: realm.name,
    detail: `Slay ${realmTarget} foes in ${realm.name}`,
    monsterId: null,
    realmId: realm.id,
    target: realmTarget,
    progress: 0,
    claimed: false,
    reward: { gold: 90 * realm.id, scrap: 5 * realm.id, essenceId: realmEssence, essence: 2 },
  }
  return [slay, elites, sweep]
}

export function withHunt(player: PlayerState, hunt?: HuntState): PlayerState {
  const current = hunt ?? huntFromUnknown(player.hunt) ?? emptyHunt()
  if (current.contracts.length === 3) return { ...player, hunt: current }
  const board = current.board || 1
  return {
    ...player,
    hunt: { ...current, board, contracts: rollBoard(player.id, player.realmId, board) },
  }
}

export function dueElite(player: PlayerState): boolean {
  return player.hunt.killsTowardElite >= ELITE_EVERY
}

export function noteKill(player: PlayerState, note: KillNote): { player: PlayerState; fulfilled: HuntContract[] } {
  const ready = withHunt(player)
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
): { ok: true; player: PlayerState; refreshed: boolean; rewardText: string } | { ok: false; reason: string } {
  const ready = withHunt(player)
  const contract = ready.hunt.contracts.find((entry) => entry.id === contractId)
  if (!contract) return { ok: false, reason: 'That hunt is gone.' }
  if (contract.claimed) return { ok: false, reason: 'Already sealed.' }
  if (contract.progress < contract.target) return { ok: false, reason: 'The hunt is still open.' }
  let contracts = ready.hunt.contracts.map((entry) =>
    entry.id === contractId ? { ...entry, claimed: true } : entry,
  )
  let board = ready.hunt.board
  const refreshed = contracts.every((entry) => entry.claimed)
  if (refreshed) {
    board += 1
    contracts = rollBoard(ready.id, ready.realmId, board)
  }
  const essences = { ...ready.essences }
  essences[contract.reward.essenceId] = (essences[contract.reward.essenceId] ?? 0) + contract.reward.essence
  return {
    ok: true,
    refreshed,
    rewardText: rewardLine(contract),
    player: {
      ...ready,
      gold: ready.gold + contract.reward.gold,
      scrap: ready.scrap + contract.reward.scrap,
      essences,
      hunt: { ...ready.hunt, board, contracts },
    },
  }
}

export function claimable(hunt: HuntState): HuntContract[] {
  return hunt.contracts.filter((contract) => !contract.claimed && contract.progress >= contract.target)
}
