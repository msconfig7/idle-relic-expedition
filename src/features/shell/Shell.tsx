import { HuntsModal } from '../combat/HuntsModal'
import { getRealm, xpIntoLevel, xpToNext } from '../../game'
import { killXp } from '../../game/xpForecast'
import { bagCapacity } from '../../game/bag'
import { RARITY_TEXT } from '../../game/rarity'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../state/gameStore'
import { RealmSelectModal } from '../combat/RealmSelectModal'
import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { XpProgressModal } from './XpProgressModal'
import { observeXp } from './xpRateTracker'

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
  const huntsOpen = useGameStore((s) => s.huntsOpen)
  const openHunts = useGameStore((s) => s.openHunts)
  const closeHunts = useGameStore((s) => s.closeHunts)
  const huntNotices = useGameStore((s) => s.huntNotices)
  const realmDoor = useGameStore((s) => s.realmDoor)
  const acknowledgeDoor = useGameStore((s) => s.acknowledgeDoor)
  const selectRealm = useGameStore((s) => s.selectRealm)
  const bossFled = useGameStore((s) => s.bossFled)
  const acknowledgeBossFled = useGameStore((s) => s.acknowledgeBossFled)
  const pendingCount = useGameStore((s) => s.pendingNodeIds.length)
  const pendingRemovalCount = useGameStore((s) => s.pendingRemovalNodeIds.length)
  const remainingPoints = player.skillPointsUnspent - pendingCount + pendingRemovalCount
  const items = useGameStore((s) => s.items)
  const unseenItemIds = useGameStore((s) => s.unseenItemIds)
  const bagCount = items.filter((item) => !item.equippedSlot).length
  const bagFull = bagCount >= bagCapacity(player.bagLevel)
  const newBagCount = unseenItemIds.length
  const realm = getRealm(player.realmId)
  const into = xpIntoLevel(player.xp, player.level)
  const need = xpToNext(player.level)
  const xpPct = Math.min(100, (into / need) * 100)
  const monsterXp = useGameStore((s) => s.combat?.monster.def.xp ?? 0)
  const xpMod = useGameStore((s) => s.stats?.xpMod ?? 1)
  const [xpOpen, setXpOpen] = useState(false)
  const [bursts, setBursts] = useState<{ id: number; level: number }[]>([])
  const levelRef = useRef(player.level)
  const burstLimit = monsterXp > 0 ? killXp(monsterXp, xpMod) * 6 : Number.POSITIVE_INFINITY

  useEffect(() => {
    observeXp(player.id, player.xp, burstLimit)
  }, [player.id, player.xp, burstLimit])

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
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-3 text-xs tabular-nums">
              <span className="inline-flex items-center gap-1 text-amber-300" title="Gold">
                <GoldIcon />
                {compact(player.gold)}
              </span>
              <span className="inline-flex items-center gap-1 text-cyan-300" title="Diamonds">
                <DiamondIcon />
                {compact(player.diamonds)}
              </span>
              <span className="inline-flex items-center gap-1 text-stone-300" title="Scrap">
                <ScrapIcon />
                {compact(player.scrap)}
              </span>
              <button
                type="button"
                className="ml-auto text-[10px] text-stone-500"
                onClick={() => {
                  localStorage.removeItem('idle-relic-expedition:guest')
                  void supabase?.auth.signOut()
                  window.location.reload()
                }}
              >
                Sign out
              </button>
            </div>
            <button
              type="button"
              className="flex w-1/5 shrink-0 flex-col items-center gap-1 rounded-lg px-1 py-0.5 outline-none transition hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-400/80"
              aria-haspopup="dialog"
              aria-expanded={xpOpen}
              aria-label={`Level ${player.level}, ${Math.floor(xpPct)}% to next level`}
              title="Level progress"
              onClick={() => setXpOpen(true)}
            >
              <span className="text-[11px] font-medium tracking-wide text-amber-100">Level: {player.level}</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-800 ring-1 ring-white/10">
                <div className="h-full rounded-full bg-purple-500" style={{ width: `${xpPct}%` }} />
              </div>
            </button>
          </div>
        </header>
        {huntNotices.length > 0 && !huntsOpen && (
          <button
            type="button"
            className="hunt-toast absolute left-3 right-3 top-16 z-20 rounded-xl border border-amber-500/80 bg-amber-950/95 px-3 py-2 text-left shadow-lg"
            onClick={openHunts}
          >
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400">Hunt fulfilled</p>
            <p className="font-serif text-sm text-amber-50">
              {huntNotices.length === 1
                ? huntNotices[0].title
                : `${huntNotices.length} quarries are ready to seal`}
            </p>
          </button>
        )}
        <main
          className={`min-h-0 flex-1 p-3 ${
            screen === 'skills' ? 'flex min-h-0 flex-col overflow-hidden' : 'overflow-y-auto'
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
                      className={`absolute -right-3 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 ${
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
              {Math.floor(grant.seconds / 60)} min · {grant.kills} kills
              {grant.elites > 0 ? ` · ${grant.elites} elites` : ''} · +{grant.xp} XP · +{grant.gold} gold ·{' '}
              {grant.drops} items · +{grant.scrap} scrap
            </p>
            {bossFled && (
              <p className="mt-2 text-sm text-amber-200">The warden withdrew. Realm bosses will not fight without you.</p>
            )}
            {grant.fulfilledHunts.length > 0 && (
              <ul className="mt-3 space-y-1">
                {grant.fulfilledHunts.map((title, index) => (
                  <li key={`${title}-${index}`} className="text-sm text-amber-100">
                    Hunt fulfilled — {title}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-amber-700 py-2 text-sm"
              onClick={acknowledge}
            >
              Continue
            </button>
          </Modal>
        )}
        {bossFled && !(grant && grant.kills > 0) && (
          <Modal title="The warden withdrew" onClose={acknowledgeBossFled}>
            <p className="text-sm text-stone-300">You were away too long. Realm bosses will not fight without you.</p>
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-amber-700 py-2 text-sm"
              onClick={acknowledgeBossFled}
            >
              Continue
            </button>
          </Modal>
        )}
        {realmDoor && (
          <Modal title={realmDoor.title} onClose={acknowledgeDoor}>
            <p className="text-sm text-stone-300">{realmDoor.body}</p>
            <div className="mt-4 grid gap-2">
              {realmDoor.nextRealmId != null && (
                <button
                  type="button"
                  className="w-full rounded-lg bg-amber-600 py-2 text-sm text-stone-950"
                  onClick={() => {
                    const nextId = realmDoor.nextRealmId
                    if (nextId != null) selectRealm(nextId)
                    acknowledgeDoor()
                  }}
                >
                  Enter {getRealm(realmDoor.nextRealmId).name}
                </button>
              )}
              <button type="button" className="w-full rounded-lg bg-stone-800 py-2 text-sm" onClick={acknowledgeDoor}>
                Stay
              </button>
            </div>
          </Modal>
        )}
        {huntsOpen && <HuntsModal onClose={closeHunts} />}
        {xpOpen && <XpProgressModal onClose={() => setXpOpen(false)} />}
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
    <svg viewBox="0 0 8 12" className="h-2.5 w-2" aria-hidden="true">
      <path
        fill="currentColor"
        d="M2.65.7h2.7c.28 0 .48.26.43.54L4.95 7.05a.95.95 0 0 1-1.9 0L2.22 1.24c-.05-.28.15-.54.43-.54ZM4 11.35a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6Z"
      />
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

function GoldIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <circle cx="8" cy="8" r="6.25" fill="currentColor" />
      <circle cx="8" cy="8" r="4.2" fill="#1c1917" fillOpacity="0.22" />
      <circle cx="8" cy="8" r="4.2" fill="none" stroke="#1c1917" strokeOpacity="0.4" strokeWidth="0.9" />
      <path
        d="M5.1 5.15a3.4 3.4 0 0 1 3.2-1.15"
        fill="none"
        stroke="#fffbeb"
        strokeOpacity="0.7"
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

function DiamondIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M8 1.25 13.45 6.05 8 14.75 2.55 6.05Z" fill="currentColor" />
      <path
        d="M2.55 6.05h10.9M5.1 6.05 8 1.25 10.9 6.05M5.45 6.05 8 14.75 10.55 6.05"
        fill="none"
        stroke="#1c1917"
        strokeOpacity="0.45"
        strokeWidth="0.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ScrapIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path fill="currentColor" fillOpacity="0.55" d="M3.2 2.4h7.6l1.7 2.15H4.9Z" />
      <path fill="currentColor" d="M1.5 7.15 3.7 4.85h9.1l2.2 2.3-2.2 2.45H3.7Z" />
      <path fill="currentColor" fillOpacity="0.75" d="M4.4 11.35h6.8l1.35 1.7H5.75Z" />
    </svg>
  )
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 10_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString()
}

