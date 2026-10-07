import { getRealm, xpIntoLevel, xpToNext } from '../../game'
import { MAX_INVENTORY } from '../../game/types'
import { RARITY_TEXT } from '../../game/rarity'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../state/gameStore'
import { RealmSelectModal } from '../combat/RealmSelectModal'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

const tabs = [
  { id: 'combat', label: 'Combat' },
  { id: 'character', label: 'Hero' },
  { id: 'inventory', label: 'Bag' },
  { id: 'skills', label: 'Path' },
] as const

export function Shell({ children }: { children: ReactNode }) {
  const player = useGameStore((s) => s.player)!
  const screen = useGameStore((s) => s.screen)
  const recentLog = useGameStore((s) => s.combat?.log)?.slice(-3) ?? []
  const setScreen = useGameStore((s) => s.setScreen)
  const grant = useGameStore((s) => s.offlineGrant)
  const acknowledge = useGameStore((s) => s.acknowledgeOffline)
  const realmPickerOpen = useGameStore((s) => s.realmPickerOpen)
  const openRealmPicker = useGameStore((s) => s.openRealmPicker)
  const pendingCount = useGameStore((s) => s.pendingNodeIds.length)
  const pendingRemovalCount = useGameStore((s) => s.pendingRemovalNodeIds.length)
  const remainingPoints = player.skillPointsUnspent - pendingCount + pendingRemovalCount
  const items = useGameStore((s) => s.items)
  const unseenItemIds = useGameStore((s) => s.unseenItemIds)
  const bagCount = items.filter((item) => !item.equippedSlot).length
  const bagFull = bagCount >= MAX_INVENTORY
  const newBagCount = unseenItemIds.length
  const realm = getRealm(player.realmId)
  const into = xpIntoLevel(player.xp, player.level)
  const need = xpToNext(player.level)
  const xpPct = Math.min(100, (into / need) * 100)
  const [bursts, setBursts] = useState<{ id: number; level: number }[]>([])
  const levelRef = useRef(player.level)

  useEffect(() => {
    if (player.level > levelRef.current) {
      const id = levelBurstSeq++
      setBursts((list) => [...list, { id, level: player.level }].slice(-3))
    }
    levelRef.current = player.level
  }, [player.level])

  return (
    <div className="flex min-h-svh justify-center bg-black text-stone-100">
      <div className="relative flex h-svh w-full max-w-[430px] flex-col overflow-hidden bg-stone-950 shadow-[0_0_80px_rgba(0,0,0,0.65)]">
        {bursts.map((burst) => (
          <LevelBurst
            key={burst.id}
            level={burst.level}
            onDone={() => setBursts((list) => list.filter((entry) => entry.id !== burst.id))}
          />
        ))}
        <header
          className="shrink-0 border-b"
          style={{
            borderColor: `${realm.theme.accent}55`,
            background: `linear-gradient(180deg, ${realm.theme.from}, #1c1917)`,
          }}
        >
          <div className="px-3 py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="shrink-0 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-semibold text-stone-950"
                onClick={openRealmPicker}
              >
                Lv. {player.level}
              </button>
              <button type="button" className="min-w-0 flex-1 truncate text-left text-sm text-amber-100" onClick={openRealmPicker}>
                {realm.name}
              </button>
              <button
                type="button"
                className="shrink-0 text-[11px] text-stone-500 underline"
                onClick={() => {
                  localStorage.removeItem('idle-relic-expedition:guest')
                  void supabase?.auth.signOut()
                  window.location.reload()
                }}
              >
                Sign out
              </button>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-xs tabular-nums">
              <span className="text-amber-300" title="Gold">● {compact(player.gold)}</span>
              <span className="text-cyan-300" title="Diamonds">◆ {compact(player.diamonds)}</span>
              <span className="text-stone-300" title="Scrap">■ {compact(player.scrap)}</span>
              <span className="ml-auto text-[11px] text-stone-500">XP {Math.floor(xpPct)}%</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-stone-800">
              <div className="h-full bg-emerald-600" style={{ width: `${xpPct}%` }} />
            </div>
          </div>
        </header>
        <main
          className={`min-h-0 flex-1 p-3 ${
            screen === 'skills' ? 'flex overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </main>
        {screen === 'combat' && (
          <div className="shrink-0 overflow-hidden border-t border-stone-800 bg-stone-950 px-3 pb-4 pt-2">
            <ul className="space-y-0.5 text-[11px] leading-4 text-stone-400">
              {recentLog.map((entry) => (
                <li
                  key={entry.id}
                  className={`truncate ${entry.rarity ? RARITY_TEXT[entry.rarity] : ''}`}
                >
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <nav className="grid shrink-0 grid-cols-4 border-t border-stone-800 bg-stone-900 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
          {tabs.map((tab) => {
            const pathBadge = tab.id === 'skills' && remainingPoints > 0
            const bagBadge = tab.id === 'inventory' && (bagFull || newBagCount > 0)
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setScreen(tab.id)}
                className={`relative flex flex-col items-center gap-0.5 px-1 py-1.5 text-xs ${
                  screen === tab.id ? 'text-amber-200' : 'text-stone-500'
                }`}
              >
                <span className="relative">
                  <TabIcon id={tab.id} />
                  {pathBadge ? (
                    <span className="absolute -right-3 -top-1.5 min-w-[1.1rem] rounded-full bg-amber-400 px-1 text-center text-[10px] leading-4 text-stone-900">
                      {remainingPoints}
                    </span>
                  ) : null}
                  {bagBadge ? (
                    <span
                      className={`absolute -right-3 -top-1.5 flex min-w-[1.1rem] items-center justify-center rounded-full px-1 text-[10px] leading-4 ${
                        bagFull ? 'bg-red-500 text-white' : 'bg-amber-400 text-stone-900'
                      }`}
                      title={bagFull ? 'Bag full' : `${newBagCount} new`}
                    >
                      {bagFull ? <BagFullGlyph /> : newBagCount}
                    </span>
                  ) : null}
                </span>
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
        {grant && grant.kills > 0 && (
          <Modal title="While you were away" onClose={acknowledge}>
            <p className="text-sm text-stone-300">
              {Math.floor(grant.seconds / 60)} min · {grant.kills} kills · +{grant.xp} XP · +{grant.gold} gold ·{' '}
              {grant.drops} items · +{grant.scrap} scrap
            </p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-amber-700 py-2 text-sm"
              onClick={acknowledge}
            >
              Continue
            </button>
          </Modal>
        )}
        {realmPickerOpen && <RealmSelectModal />}
      </div>
    </div>
  )
}

const LEVEL_SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 2) * 0.2
  const dist = 48 + (i % 5) * 26
  return {
    dx: `${Math.cos(angle) * dist}px`,
    dy: `${Math.sin(angle) * dist}px`,
    delay: `${(i % 6) * 28}ms`,
    size: i % 4 === 0 ? 8 : 4,
    color: i % 3 === 0 ? '#fff7ed' : i % 3 === 1 ? '#fde68a' : '#f59e0b',
  }
})

let levelBurstSeq = 1

function LevelBurst({ level, onDone }: { level: number; onDone: () => void }) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  useEffect(() => {
    const timer = window.setTimeout(() => onDoneRef.current(), 3500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      <div className="level-glow absolute left-1/2 top-[42%] h-48 w-48" />
      <div className="level-ring absolute left-1/2 top-[42%] h-28 w-28 rounded-full border border-amber-100/80" />
      <div className="level-ring level-ring-late absolute left-1/2 top-[42%] h-20 w-20 rounded-full border border-amber-300/70" />
      {LEVEL_SPARKS.map((spark, index) => (
        <span
          key={index}
          className="level-spark absolute left-1/2 top-[42%] rounded-full"
          style={{
            width: spark.size,
            height: spark.size,
            background: spark.color,
            boxShadow: `0 0 10px ${spark.color}`,
            '--dx': spark.dx,
            '--dy': spark.dy,
            '--delay': spark.delay,
          } as CSSProperties}
        />
      ))}
      <p className="level-label absolute left-1/2 top-[42%] font-serif text-3xl tracking-wide text-amber-50">
        Level {level}
      </p>
    </div>
  )
}

function BagFullGlyph() {
  return (
    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" aria-hidden="true">
      <path
        d="M3.5 4.5V3.2a2.5 2.5 0 0 1 5 0v1.3M2.5 4.5h7l.6 6H1.9l.6-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M4 7.5h4M6 5.5v4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

function TabIcon({ id }: { id: (typeof tabs)[number]['id'] }) {
  const common = {
    className: 'h-5 w-5',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  if (id === 'combat') {
    return (
      <svg {...common}>
        <path d="m5 3 6 6-2 2-6-6V3h2Z" />
        <path d="m19 3-6 6 2 2 6-6V3h-2Z" />
        <path d="m8 12-5 5 4 4 5-5M16 12l5 5-4 4-5-5" />
      </svg>
    )
  }
  if (id === 'character') {
    return (
      <svg {...common}>
        <path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z" />
        <path d="M9 10a3 3 0 0 1 6 0M8.5 16c.8-1.8 2-2.7 3.5-2.7s2.7.9 3.5 2.7" />
      </svg>
    )
  }
  if (id === 'inventory') {
    return (
      <svg {...common}>
        <path d="M7 8V6a5 5 0 0 1 10 0v2" />
        <path d="M5 8h14l1 13H4L5 8Z" />
        <path d="M8 12v1M16 12v1" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="6" r="2" />
      <path d="M7.5 16.5c1.5-2 1.5-4 0-6s.5-4 3-3 3.5 0 5.5-1" />
      <path d="m17 13 .8 1.7L20 15l-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1L14 15l2.2-.3L17 13Z" />
    </svg>
  )
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

