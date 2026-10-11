import { rewardLine } from '../../game/contracts'
import type { HuntContract } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import { Modal } from '../ui/Modal'
import { useState } from 'react'

export function HuntsModal({ onClose }: { onClose: () => void }) {
  const player = useGameStore((s) => s.player)!
  const claimContract = useGameStore((s) => s.claimContract)
  const [flash, setFlash] = useState<string | null>(null)
  const contracts = player.hunt.contracts

  return (
    <Modal title="Hunt board" onClose={onClose}>
      <p className="text-[11px] leading-4 text-stone-400">
        Three quarries. Fill a slip, then press the seal to take the reward. Clear the board and a new set is posted.
      </p>
      {flash && (
        <p className="hunt-toast mt-2 rounded-lg border border-amber-700/70 bg-amber-950/70 px-3 py-2 text-sm text-amber-100">
          {flash}
        </p>
      )}
      <div className="mt-3 grid gap-2.5">
        {contracts.map((contract, index) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            index={index}
            onClaim={() => {
              const outcome = claimContract(contract.id)
              if (!outcome.ok) {
                setFlash(outcome.reason)
                return
              }
              setFlash(outcome.refreshed ? 'Board cleared. New hunts are posted.' : outcome.rewardText)
            }}
          />
        ))}
      </div>
    </Modal>
  )
}

function ContractCard({
  contract,
  index,
  onClaim,
}: {
  contract: HuntContract
  index: number
  onClaim: () => void
}) {
  const ready = !contract.claimed && contract.progress >= contract.target
  const pct = Math.min(100, (contract.progress / contract.target) * 100)
  return (
    <article
      className={`contract-deal relative overflow-hidden rounded-xl border px-3 py-2.5 ${
        contract.claimed
          ? 'border-stone-800 bg-stone-950/80'
          : ready
            ? 'contract-ready border-amber-600/80 bg-gradient-to-br from-amber-200/15 via-stone-900 to-stone-950'
            : 'border-amber-900/50 bg-gradient-to-br from-amber-100/10 via-stone-900 to-stone-950'
      }`}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="flex items-start gap-2">
        <Seal kind={contract.kind} ready={ready} claimed={contract.claimed} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-amber-600/90">
            {contract.kind === 'elite' ? 'Elite quarry' : contract.kind === 'realm' ? 'Realm sweep' : 'Named prey'}
          </p>
          <p className={`font-serif text-base leading-tight ${contract.claimed ? 'text-stone-500' : 'text-amber-50'}`}>
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
      {contract.claimed && <span className="contract-stamp">Sealed</span>}
    </article>
  )
}

function Seal({ kind, ready, claimed }: { kind: HuntContract['kind']; ready: boolean; claimed: boolean }) {
  const mark = kind === 'elite' ? '◆' : kind === 'realm' ? '☼' : '†'
  return (
    <span
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-sm ${
        claimed
          ? 'border-stone-700 text-stone-600'
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
