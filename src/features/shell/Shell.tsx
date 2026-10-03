import { REALM_PROGRESS_CAP, xpIntoLevel, xpToNext } from '../../game'
import { getRealm } from '../../game'
import { supabase } from '../../lib/supabase'
import { useGameStore } from '../../state/gameStore'
import { RealmSelectModal } from '../combat/RealmSelectModal'
import { Modal } from '../ui/Modal'
import type { ReactNode } from 'react'

const tabs = [
  { id: 'combat', label: 'Combat' },
  { id: 'character', label: 'Hero' },
  { id: 'inventory', label: 'Bag' },
  { id: 'skills', label: 'Path' },
] as const

export function Shell({ children }: { children: ReactNode }) {
  const player = useGameStore((s) => s.player)!
  const screen = useGameStore((s) => s.screen)
  const setScreen = useGameStore((s) => s.setScreen)
  const grant = useGameStore((s) => s.offlineGrant)
  const acknowledge = useGameStore((s) => s.acknowledgeOffline)
  const realmPickerOpen = useGameStore((s) => s.realmPickerOpen)
  const openRealmPicker = useGameStore((s) => s.openRealmPicker)
  const pendingCount = useGameStore((s) => s.pendingNodeIds.length)
  const pendingRemovalCount = useGameStore((s) => s.pendingRemovalNodeIds.length)
  const remainingPoints = player.skillPointsUnspent - pendingCount + pendingRemovalCount
  const realm = getRealm(player.realmId)
  const into = xpIntoLevel(player.xp, player.level)
  const need = xpToNext(player.level)
  const xpPct = Math.min(100, (into / need) * 100)
  const realmPct =
    player.realmId < player.highestRealmId
      ? 100
      : Math.min(100, (player.realmProgress / REALM_PROGRESS_CAP) * 100)
  const realmLabel = player.realmId < player.highestRealmId ? 'Cleared' : `${Math.floor(realmPct)}%`

  return (
    <div className="flex min-h-svh justify-center bg-black text-stone-100">
      <div className="relative flex h-svh w-full max-w-[430px] flex-col overflow-hidden bg-stone-950 shadow-[0_0_80px_rgba(0,0,0,0.65)]">
        <header
          className="shrink-0 border-b px-3 py-2"
          style={{
            borderColor: `${realm.theme.accent}55`,
            background: `linear-gradient(180deg, ${realm.theme.from}, #1c1917)`,
          }}
        >
          <div className="flex items-start gap-2">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={openRealmPicker}>
                <p className="text-[10px] uppercase tracking-[0.25em] text-amber-600">Idle Relic Expedition</p>
                <h1 className="truncate font-serif text-base text-amber-100">
                  Lv {player.level} · {realm.name}
                </h1>
              </button>
            <button
              type="button"
              className="shrink-0 pt-1 text-[11px] text-stone-500 underline"
              onClick={() => {
                localStorage.removeItem('idle-relic-expedition:guest')
                void supabase?.auth.signOut()
                window.location.reload()
              }}
            >
              Sign out
            </button>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <Currency label="Gold" value={player.gold} color="text-amber-300" />
            <Currency label="Diamonds" value={player.diamonds} color="text-cyan-300" />
            <Currency label="Scrap" value={player.scrap} color="text-stone-300" />
          </div>
          <div className="mt-2 grid gap-2">
            <Bar title="XP" label={`${into} / ${need}`} pct={xpPct} color="bg-emerald-600" />
            <Bar title="Realm progress" label={realmLabel} pct={realmPct} color="bg-orange-600" />
          </div>
        </header>
        <main
          className={`min-h-0 flex-1 p-3 ${
            screen === 'skills' ? 'flex overflow-hidden' : 'overflow-y-auto'
          }`}
        >
          {children}
        </main>
        <nav className="grid shrink-0 grid-cols-4 border-t border-stone-800 bg-stone-900 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setScreen(tab.id)}
              className={`relative flex flex-col items-center gap-0.5 px-1 py-1.5 text-xs ${
                screen === tab.id ? 'text-amber-200' : 'text-stone-500'
              }`}
            >
              <TabIcon id={tab.id} />
              <span>{tab.label}</span>
              {tab.id === 'skills' && remainingPoints > 0 ? (
                <span className="absolute right-2 top-1 rounded-full bg-amber-400 px-1.5 text-[10px] text-stone-900">
                  {remainingPoints}
                </span>
              ) : null}
            </button>
          ))}
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

function Currency({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg border border-stone-800 bg-stone-950 px-2 py-1">
      <p className="text-[10px] uppercase tracking-wide text-stone-500">{label}</p>
      <p className={`truncate text-sm font-medium ${color}`}>{value.toLocaleString()}</p>
    </div>
  )
}

function Bar({
  title,
  label,
  pct,
  color,
}: {
  title: string
  label: string
  pct: number
  color: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-stone-500">{title}</p>
        <p className="truncate text-[11px] tabular-nums text-stone-400">{label}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-stone-800">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
