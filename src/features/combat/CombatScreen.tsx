import { getRealm } from '../../game'
import { useGameStore } from '../../state/gameStore'
import type { FloatingHit } from '../../game/types'
import { useEffect, useRef, useState } from 'react'

export function CombatScreen() {
  const player = useGameStore((s) => s.player)!
  const combat = useGameStore((s) => s.combat)!
  const stats = useGameStore((s) => s.stats)!
  const monsterIndex = useGameStore((s) => s.monsterIndex)
  const queuedMonsterIndex = useGameStore((s) => s.queuedMonsterIndex)
  const queueMonster = useGameStore((s) => s.queueMonster)
  const openRealmPicker = useGameStore((s) => s.openRealmPicker)
  const realm = getRealm(player.realmId)
  const monsterPct = (combat.monster.hp / combat.monster.maxHp) * 100
  const playerPct = (combat.playerHp / combat.playerMaxHp) * 100
  const outgoing = latest(combat.floats, (hit) => hit.kind === 'player' || hit.kind === 'crit')
  const incoming = latest(combat.floats, (hit) => hit.kind === 'monster' || hit.kind === 'block')
  const heal = latest(combat.floats, (hit) => hit.kind === 'heal')
  const cleared = player.realmId < player.highestRealmId
  const lastOutId = useRef<number | null>(null)
  const portraitRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!outgoing || lastOutId.current === outgoing.id) return
    lastOutId.current = outgoing.id
    const el = portraitRef.current
    if (!el) return
    el.classList.remove('monster-hit-flash')
    void el.offsetWidth
    el.classList.add('monster-hit-flash')
  }, [outgoing])

  return (
    <div className="grid gap-3">
      <section
        className="relative overflow-hidden rounded-2xl border p-4"
        style={{
          borderColor: realm.theme.accent,
          background: `linear-gradient(180deg, ${realm.theme.from}, ${realm.theme.to})`,
        }}
      >
        <img src={realm.image} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30" />
        {combat.deathCooldownMs > 0 && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-black/55">
            <p className="rounded-lg border border-red-900/70 bg-red-950/90 px-4 py-2 text-center text-sm text-amber-100 shadow-lg">
              Downed — no attacks · {Math.ceil(combat.deathCooldownMs / 1000)}s
            </p>
          </div>
        )}
        <div className="relative">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.2em]" style={{ color: realm.theme.accent }}>
                {realm.name}
              </p>
              <h2 className="mt-1 font-serif text-xl text-amber-50">{combat.monster.def.name}</h2>
            </div>
            <button
              type="button"
              className="relative z-30 shrink-0 cursor-pointer rounded-lg border border-amber-800/80 bg-stone-950/70 px-2.5 py-1.5 text-xs text-amber-100"
              onClick={openRealmPicker}
            >
              Realms
            </button>
          </div>
          <div className="relative mx-auto mt-4 grid h-32 place-items-center">
            <img
              ref={portraitRef}
              src={combat.monster.def.image}
              alt=""
              className="h-32 w-32 object-contain drop-shadow-[0_6px_10px_rgba(0,0,0,0.7)]"
            />
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <HitNumber hit={outgoing} className="text-center text-lg font-bold" />
            </div>
          </div>
          <div className="mt-2">
          <Bar overlay={`${Math.ceil(combat.monster.hp)}/${combat.monster.maxHp}`} pct={monsterPct} color="bg-red-600" />
          </div>
          <div className="mt-3">
            <p className="mb-1 text-sm text-stone-300">You</p>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <Bar
                  overlay={`${Math.ceil(combat.playerHp)}/${combat.playerMaxHp}`}
                  pct={playerPct}
                  color="bg-emerald-600"
                />
              </div>
              <div className="flex h-5 min-w-[4.75rem] shrink-0 items-center justify-end gap-1.5">
                <HitNumber hit={incoming} className="w-8 text-right text-sm font-semibold" />
                <HitNumber hit={heal} className="w-8 text-left text-sm font-semibold" />
              </div>
            </div>
          </div>
          {cleared && (
            <p className="mt-3 text-center text-xs text-amber-200">This realm is cleared. Hunt or travel onward.</p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border border-stone-800 bg-stone-900 p-3">
        <h3 className="text-xs uppercase tracking-wide text-stone-500">Hunt</h3>
        <p className="mt-0.5 text-[11px] text-stone-500">
          Queue a target. It swaps after a kill or when you are downed.
        </p>
        <div className="mt-2 grid gap-1.5">
          {realm.monsters.map((monster, index) => {
            const fighting = index === monsterIndex
            const queued = index === queuedMonsterIndex
            return (
              <button
                key={monster.id}
                type="button"
                onClick={() => queueMonster(index)}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left ${
                  fighting
                    ? 'border-amber-700 bg-amber-950/40'
                    : queued
                      ? 'border-amber-800/70 bg-stone-950'
                      : 'border-stone-800 bg-stone-950 hover:border-stone-600'
                }`}
              >
                <img src={monster.image} alt="" className="h-10 w-10 shrink-0 object-contain" />
                <div className="min-w-0">
                  <p className={`text-sm ${fighting || queued ? 'text-amber-100' : 'text-stone-200'}`}>
                    {monster.name}
                    {fighting ? ' · fighting' : queued ? ' · next' : ''}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-stone-400">
                    HP {monster.hp} · ATK {monster.attack} · XP {monster.xp}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </section>
      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-3 text-sm">
        <h3 className="text-xs uppercase tracking-wide text-stone-500">Power</h3>
        <p>
          ATK {stats.attack} · DEF {stats.defense}
        </p>
        <p>
          Regen {stats.hpRegen.toFixed(1)}/s · Steal {(stats.lifeSteal * 100).toFixed(1)}%
        </p>
        <p>
          Crit {(stats.critChance * 100).toFixed(1)}% · Block {(stats.block * 100).toFixed(1)}%
        </p>
      </div>
      <div className="max-h-48 overflow-y-auto rounded-2xl border border-stone-800 bg-stone-900 p-3">
        <h3 className="text-xs uppercase tracking-wide text-stone-500">Kill log</h3>
        <ul className="mt-2 space-y-1 text-xs text-stone-400">
          {[...combat.log].reverse().map((entry) => (
            <li key={entry.id}>{entry.text}</li>
          ))}
        </ul>
      </div>
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
    if (!hit) return
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
