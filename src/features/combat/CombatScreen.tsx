import { bossForRealm } from '../../content/bosses'
import { REALM_PROGRESS_CAP, getRealm, nextRealm } from '../../game'
import { wardenAwaits } from '../../game/boss'
import { DESPAWN_MS } from '../../game/types'
import { useGameStore } from '../../state/gameStore'
import type { FloatingHit } from '../../game/types'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState } from 'react'

export function CombatScreen() {
  const player = useGameStore((s) => s.player)!
  const combat = useGameStore((s) => s.combat)!
  const monsterIndex = useGameStore((s) => s.monsterIndex)
  const queuedMonsterIndex = useGameStore((s) => s.queuedMonsterIndex)
  const queueMonster = useGameStore((s) => s.queueMonster)
  const openRealmPicker = useGameStore((s) => s.openRealmPicker)
  const challengeBoss = useGameStore((s) => s.challengeBoss)
  const openHunts = useGameStore((s) => s.openHunts)
  const realm = getRealm(player.realmId)
  const monsterPct = (combat.monster.hp / combat.monster.maxHp) * 100
  const playerPct = (combat.playerHp / combat.playerMaxHp) * 100
  const outgoing = latest(combat.floats, (hit) => hit.kind === 'player' || hit.kind === 'crit')
  const incoming = latest(combat.floats, (hit) => hit.kind === 'monster' || hit.kind === 'block')
  const heal = latest(combat.floats, (hit) => hit.kind === 'heal')
  //const cleared = player.realmId < player.highestRealmId
  const lastOutId = useRef<number | null>(null)
  const portraitRef = useRef<HTMLImageElement>(null)
  const [panel, setPanel] = useState<'targets' | null>(null)
  const [slashId, setSlashId] = useState<number | null>(null)
  const realmPct =
    player.realmId < player.highestRealmId
      ? 100
      : Math.min(100, (player.realmProgress / REALM_PROGRESS_CAP) * 100)
  const despawning = combat.despawnMs > 0
  const boss = bossForRealm(player.realmId)
  const bossLive = combat.monster.boss && combat.bossPauseMs === 0 && combat.deathCooldownMs === 0
  const showChallenge = Boolean(boss) && wardenAwaits(player) && !combat.monster.boss
  const realmLabel =
    player.realmId < player.highestRealmId ? 'Cleared' : showChallenge ? 'Warden' : `${Math.floor(realmPct)}%`
  const next = nextRealm(player.realmId)
  const readyHunts = player.hunt.contracts.filter((contract) => !contract.claimed && contract.progress >= contract.target).length
  const bossSeconds = Math.max(0, Math.ceil(combat.bossTimeLeftMs / 1000))
  const bossLimit = boss?.timeLimitMs ?? combat.bossTimeLeftMs
  const bossPct = bossLimit > 0 ? Math.max(0, Math.min(100, (combat.bossTimeLeftMs / bossLimit) * 100)) : 0

  useEffect(() => {
    setSlashId(null)
    lastOutId.current = null
    const el = portraitRef.current
    if (el) el.classList.remove('monster-hit-flash')
  }, [combat.encounter])

  useEffect(() => {
    if (!outgoing || lastOutId.current === outgoing.id) return
    lastOutId.current = outgoing.id
    if (combat.despawnMs > 0) return
    const el = portraitRef.current
    if (el) {
      el.classList.remove('monster-hit-flash')
      void el.offsetWidth
      el.classList.add('monster-hit-flash')
    }
    setSlashId(outgoing.id)
  }, [outgoing, combat.despawnMs])

  return (
    <div className="grid gap-2">
      <div className="-mx-3 -mt-3 bg-stone-950 px-3 pb-2 pt-2">
        <Bar
          overlay={`${Math.ceil(combat.playerHp)}/${combat.playerMaxHp}`}
          pct={playerPct}
          color="bg-emerald-500"
        />
        <div className="mt-1 grid h-4 grid-cols-[2.5rem_2.5rem] items-center justify-center gap-0.5">
          <HitNumber hit={incoming} className="block w-full text-center text-sm font-semibold" />
          <HitNumber hit={heal} className="block w-full text-center text-sm font-semibold" />
        </div>
      </div>
      <section
        className="relative overflow-hidden rounded-2xl border px-3 pb-3 pt-2"
        style={{
          borderColor: realm.theme.accent,
          background: `linear-gradient(180deg, ${realm.theme.from}, ${realm.theme.to})`,
        }}
      >
        <img src={realm.image} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
        {combat.deathCooldownMs > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/55">
            <p className="rounded-lg border border-red-900/70 bg-red-950/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg">
              {combat.bossFailed
                ? `Downed — the warden remains · ${Math.ceil(combat.deathCooldownMs / 1000)}s`
                : `Downed — no attacks · ${Math.ceil(combat.deathCooldownMs / 1000)}s`}
            </p>
          </div>
        )}
        {combat.bossPauseMs > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/55">
            <p className="rounded-lg border border-amber-800/80 bg-stone-950/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg">
              Time — the warden withdraws
            </p>
          </div>
        )}
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <h2 className={`text-left font-serif text-lg leading-tight ${combat.monster.elite || combat.monster.boss ? 'text-amber-200' : 'text-amber-50'}`}>
              {combat.monster.elite ? `Elite ${combat.monster.def.name}` : combat.monster.def.name}
            </h2>
            {combat.enraged && <span className="shrink-0 text-[10px] uppercase tracking-widest text-red-300">Enraged</span>}
          </div>
          <p className="text-[11px] leading-4 text-amber-100/75">
            {combat.monster.def.trait.name} — {combat.monster.def.trait.blurb}
          </p>
          {combat.monster.boss && (
            <div className="mt-1.5">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-amber-100/80">
                <span>Warden</span>
                <span className={bossSeconds <= 10 ? 'text-red-300' : ''}>{bossSeconds}s</span>
              </div>
              <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-black/45">
                <div className={`h-full ${bossSeconds <= 10 ? 'bg-red-500' : 'bg-amber-300'}`} style={{ width: `${bossPct}%` }} />
              </div>
            </div>
          )}
          <div className="relative mx-auto mt-6 grid h-36 place-items-center">
            <img
              key={combat.encounter}
              ref={portraitRef}
              src={combat.monster.def.image}
              alt=""
              className={`relative h-36 w-36 object-contain ${
                combat.monster.elite ? 'elite-portrait' : 'drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)]'
              } ${combat.monster.boss ? 'scale-110' : ''} ${
                despawning ? 'monster-despawn' : 'monster-arrive'
              }`}
              style={despawning ? { animationDuration: `${DESPAWN_MS}ms` } : undefined}
            />
            {slashId != null && !despawning && (
              <span key={slashId} className="monster-slice pointer-events-none absolute" aria-hidden />
            )}
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <HitNumber hit={outgoing} className="text-center text-2xl font-bold" />
            </div>
          </div>
          <Bar
            overlay={`${Math.ceil(combat.monster.hp)}/${combat.monster.maxHp}`}
            pct={monsterPct}
            color="bg-red-600"
          />
        </div>
      </section>
      <div
        className="overflow-hidden rounded-xl border-black/50"
        style={{ background: realm.theme.accent }}
      >
        <div className="flex items-center gap-2 px-3 py-2">
        <div className="min-w-0 flex-1 text-stone-950">
          <p className="truncate text-sm font-semibold">{realm.name}</p>
          <p className="truncate text-[11px]">
            {combat.monster.elite ? `Elite ${combat.monster.def.name}` : combat.monster.def.name}
          </p>
        </div>
        <button
          type="button"
          aria-label="Hunt board"
          className="relative grid shrink-0 place-items-center rounded-lg bg-black/25 px-2.5 py-1.5 text-stone-950"
          onClick={openHunts}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M7 3.5h8l4 4V20a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
            <path d="M15 3.5V8h4.5M8.5 12h7M8.5 16h5" />
          </svg>
          {readyHunts > 0 && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-amber-400 px-1 text-center text-[10px] leading-4 text-stone-950">
              {readyHunts}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="Choose monster"
          disabled={bossLive}
          className="grid shrink-0 place-items-center rounded-lg bg-black/25 px-2.5 py-1.5 text-stone-950 disabled:opacity-40"
          onClick={() => setPanel('targets')}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.5c-4.6 0-8 3.3-8 7.6 0 2.6 1.3 4.8 3.3 6.2V19c0 .8.7 1.5 1.5 1.5H10v-2h1.4V20.5h1.2V18.5H14v2h1.2c.8 0 1.5-.7 1.5-1.5v-2.7c2-1.4 3.3-3.6 3.3-6.2 0-4.3-3.4-7.6-8-7.6Zm-3.1 8.1a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4Zm6.2 0a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM9.4 15.6c.5.7 1.5 1.1 2.6 1.1s2.1-.4 2.6-1.1l.8.7c-.8 1-2 1.5-3.4 1.5s-2.6-.5-3.4-1.5l.8-.7Z" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Realm"
          className="grid shrink-0 cursor-pointer place-items-center rounded-lg bg-black/25 px-2.5 py-1.5 text-stone-950 disabled:opacity-40"
          disabled={bossLive}
          onClick={openRealmPicker}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="8" />
            <path d="M4 12h16" />
            <path d="M12 4c2.3 2.3 3.4 5 3.4 8s-1.1 5.7-3.4 8c-2.3-2.3-3.4-5-3.4-8s1.1-5.7 3.4-8Z" />
          </svg>
        </button>
        </div>
        <div
          className="h-2 border-t border-black/45 bg-black/40"
          role="progressbar"
          aria-valuenow={Math.floor(realmPct)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Realm progress"
          title={realmLabel}
        >
          <div className="h-full bg-black/60" style={{ width: `${realmPct}%` }} />
        </div>
      </div>
      {showChallenge && boss && (
        <button
          type="button"
          onClick={challengeBoss}
          className="rounded-xl border border-amber-500/80 bg-gradient-to-r from-amber-800 to-amber-600 px-3 py-2.5 text-left text-stone-950"
        >
          <p className="font-serif text-base leading-tight">Challenge {boss.name}</p>
          <p className="text-[11px] leading-4">
            {Math.round(boss.timeLimitMs / 1000)}s on the field.
            {next ? ` Victory opens ${next.name}.` : ' This is the end of the map.'}
          </p>
        </button>
      )}
      {panel === 'targets' && (
        <Modal title="Targets" onClose={() => setPanel(null)}>
          <p className="text-[11px] text-stone-500">
            Queue a target. It swaps after a kill or when you are downed.
          </p>
          <div className="mt-2 grid gap-1.5">
            {realm.monsters.map((monster, index) => {
              const active = index === monsterIndex
              const queued = index === queuedMonsterIndex
              return (
                <button
                  key={monster.id}
                  type="button"
                  onClick={() => {
                    queueMonster(index)
                    setPanel(null)
                  }}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                    active
                      ? 'border-amber-700 bg-amber-950/40'
                      : queued
                        ? 'border-amber-800/70 bg-stone-950'
                        : 'border-stone-800 bg-stone-950 hover:border-stone-600'
                  }`}
                >
                  <img src={monster.image} alt="" className="h-10 w-10 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <p className={`text-sm ${active || queued ? 'text-amber-100' : 'text-stone-200'}`}>
                      {monster.name}
                      {active ? ' · fighting' : queued ? ' · next' : ''}
                    </p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-stone-400">
                      HP {monster.hp} · ATK {monster.attack} · XP {monster.xp}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </Modal>
      )}
    </div>
  )
}

function latest(hits: FloatingHit[], match: (hit: FloatingHit) => boolean): FloatingHit | undefined {
  for (let i = hits.length - 1; i >= 0; i--) {
    if (match(hits[i])) return hits[i]
  }
  return undefined
}

function HitNumber({ hit, className }: { hit: FloatingHit | undefined; className: string }) {
  const [shown, setShown] = useState<FloatingHit | null>(null)
  const [token, setToken] = useState(0)

  useEffect(() => {
    if (!hit) {
      setShown(null)
      return
    }
    let showTimer = 0
    setShown(null)
    showTimer = window.setTimeout(() => {
      setShown(hit)
      setToken((n) => n + 1)
    }, 90)
    return () => window.clearTimeout(showTimer)
  }, [hit?.id])

  if (!shown) return <span className={className} />

  return (
    <span key={token} className={`hit-number tabular-nums ${className} ${floatClass(shown)}`}>
      {labelFor(shown)}
    </span>
  )
}

function labelFor(hit: FloatingHit): string {
  if (hit.kind === 'monster') return `-${hit.text}`
  if (hit.kind === 'heal') return hit.text.startsWith('+') ? hit.text : `+${hit.text}`
  return hit.text
}

function floatClass(hit: FloatingHit): string {
  if (hit.kind === 'crit') return 'text-yellow-300'
  if (hit.kind === 'heal') return 'text-emerald-400'
  if (hit.kind === 'block') return 'text-sky-300'
  if (hit.kind === 'monster') return 'text-red-400'
  return 'text-stone-100'
}

function Bar({
  overlay,
  pct,
  color,
}: {
  overlay: string
  pct: number
  color: string
}) {
  return (
    <div className="relative h-5 overflow-hidden rounded-full bg-black/45">
      <div className={`h-full ${color}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      <span className="absolute inset-0 grid place-items-center text-[11px] font-medium tabular-nums text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.8)]">
        {overlay}
      </span>
    </div>
  )
}
