import { HUNT_SEAL_DIAMONDS, rewardLine } from '../../game/contracts'
import type { HuntContract } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'
import { useEffect, useState } from 'react'

function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`
}

export function HuntsModal({ onClose }: { onClose: () => void }) {
  const player = useGameStore((s) => s.player)!
  const combat = useGameStore((s) => s.combat)
  const claimContract = useGameStore((s) => s.claimContract)
  const claimBoardDiamonds = useGameStore((s) => s.claimBoardDiamonds)
  const seekPrey = useGameStore((s) => s.seekPrey)
  const [flash, setFlash] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const contracts = player.hunt.contracts
  const nextBoardAt = player.hunt.nextBoardAt
  const boardSealed = contracts.length > 0 && contracts.every((contract) => contract.claimed)
  const diamondsReady = boardSealed && player.hunt.diamondRewardBoard != null
  const waiting = boardSealed && nextBoardAt != null && nextBoardAt > now

  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [waiting])

  return (
    <Modal title="Hunt board" onClose={onClose}>
      {waiting && nextBoardAt != null && (
        <p className="mt-2 rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm tabular-nums text-stone-200">
          New hunts in {formatWait(nextBoardAt - now)}
        </p>
      )}
      {diamondsReady && (
        <button
          type="button"
          onClick={() => {
            const outcome = claimBoardDiamonds()
            setFlash(outcome.ok ? outcome.rewardText : outcome.reason)
          }}
          className="mt-2 w-full rounded-full bg-cyan-300 py-1.5 text-sm font-semibold text-stone-950"
        >
          Claim {HUNT_SEAL_DIAMONDS} diamonds
        </button>
      )}
      {flash && (
        <p className="hunt-toast mt-2 rounded-lg border border-amber-700/70 bg-amber-950/70 px-3 py-2 text-sm text-amber-100">
          {flash}
        </p>
      )}
      <div className="mt-3 grid gap-2.5">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            hunting={
              contract.kind === 'monster' &&
              contract.monsterId != null &&
              contract.realmId === player.realmId &&
              combat != null &&
              !combat.monster.boss &&
              combat.monster.def.id === contract.monsterId
            }
            onClaim={() => {
              const outcome = claimContract(contract.id)
              if (!outcome.ok) {
                setFlash(outcome.reason)
                return
              }
              setFlash(outcome.rewardText)
            }}
            onSeek={() => {
              if (!contract.monsterId) return
              const outcome = seekPrey(contract.monsterId, contract.realmId)
              if (!outcome.ok) {
                setFlash(outcome.reason)
                return
              }
              onClose()
            }}
          />
        ))}
      </div>
    </Modal>
  )
}

function ContractCard({
  contract,
  hunting,
  onClaim,
  onSeek,
}: {
  contract: HuntContract
  hunting: boolean
  onClaim: () => void
  onSeek: () => void
}) {
  const ready = !contract.claimed && contract.progress >= contract.target
  const pct = Math.min(100, (contract.progress / contract.target) * 100)
  return (
    <article
      className={`contract-deal relative overflow-hidden rounded-xl border px-3 py-2.5 ${
        contract.claimed
          ? 'border-stone-700 bg-stone-950'
          : ready
            ? 'contract-ready border-amber-600/80 bg-gradient-to-br from-amber-200/15 via-stone-900 to-stone-950'
            : 'border-amber-900/50 bg-gradient-to-br from-amber-100/10 via-stone-900 to-stone-950'
      }`}
    >
      <div className="flex items-stretch gap-2">
        <Seal kind={contract.kind} ready={ready} claimed={contract.claimed} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/90">
              {contract.kind === 'elite' ? 'Elite quarry' : contract.kind === 'realm' ? 'Realm sweep' : 'Named prey'}
            </p>
            {contract.claimed && <span className="contract-stamp">Sealed</span>}
          </div>
          <p className={`font-serif text-base leading-tight ${contract.claimed ? 'text-stone-300' : 'text-amber-50'}`}>
            {contract.detail}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/50">
            <div
              className={`h-full ${ready || contract.claimed ? 'bg-amber-400' : 'bg-stone-400'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-stone-300">
            {Math.min(contract.progress, contract.target)}/{contract.target}
          </p>
          <p className="text-[11px] text-amber-200/90">{rewardLine(contract)}</p>
        </div>
        {contract.kind === 'monster' && contract.monsterId && !contract.claimed && (
          <button
            type="button"
            onClick={onSeek}
            aria-label={hunting ? `Already hunting ${contract.title}` : `Go to ${contract.title}`}
            title={hunting ? 'On this quarry' : `Go to ${contract.title}`}
            className="flex w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-amber-600/80 bg-stone-950 text-amber-100"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h12" strokeLinecap="round" />
              <path d="M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[9px] font-semibold uppercase tracking-wide">{hunting ? 'Here' : 'Go'}</span>
          </button>
        )}
      </div>
      {ready && (
        <button
          type="button"
          onClick={onClaim}
          className="mt-2 w-full rounded-full bg-amber-500 py-1.5 text-sm font-semibold text-stone-950"
        >
          Seal and collect
        </button>
      )}
    </article>
  )
}

function Seal({ kind, ready, claimed }: { kind: HuntContract['kind']; ready: boolean; claimed: boolean }) {
  const mark = kind === 'elite' ? '◆' : kind === 'realm' ? '☼' : '†'
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center self-start rounded-full border text-sm ${
        claimed
          ? 'border-stone-600 bg-stone-900 text-stone-400'
          : ready
            ? 'border-amber-300 bg-amber-500 text-stone-950'
            : 'border-amber-800/80 bg-amber-950 text-amber-200'
      }`}
      aria-hidden
    >
      {mark}
    </span>
  )
}
