import { TICK_MS, PERSIST_MS } from './game/types'
import { loadSave, persistSave, runSettlement } from './lib/persist'
import { supabase, supabaseConfigured } from './lib/supabase'
import { useGameStore } from './state/gameStore'
import { CombatScreen } from './features/combat/CombatScreen'
import { CharacterScreen } from './features/character/CharacterScreen'
import { InventoryScreen } from './features/inventory/InventoryScreen'
import { SkillTreeScreen } from './features/skills/SkillTreeScreen'
import { Shell } from './features/shell/Shell'
import { AuthScreen } from './features/auth/AuthScreen'
import { newId } from './lib/id'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

export function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [localId, setLocalId] = useState<string | null>(() => {
    if (supabaseConfigured) return null
    return localStorage.getItem('idle-relic-expedition:guest')
  })
  const [boot, setBoot] = useState<'auth' | 'loading' | 'ready'>('loading')
  const ready = useGameStore((s) => s.ready)
  const paused = useGameStore((s) => s.paused)
  const screen = useGameStore((s) => s.screen)

  useEffect(() => {
    if (!supabaseConfigured || !supabase) {
      setBoot((current) => {
        if (!localId) return 'auth'
        if (current === 'ready') return current
        return 'loading'
      })
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setBoot(data.session ? 'loading' : 'auth')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setBoot(next ? 'loading' : 'auth')
    })
    return () => data.subscription.unsubscribe()
  }, [localId])

  useEffect(() => {
    const userId = session?.user.id ?? localId
    if (!userId || boot !== 'loading') return
    void (async () => {
      try {
        const save = await loadSave(userId)
        const knownItemIds = save.items.map((item) => item.id)
        const { grant } = await runSettlement(save.player, save.items)
        useGameStore.getState().hydrate(grant.player, grant.items, knownItemIds)
        if (grant.kills > 0) {
          useGameStore.setState({ offlineGrant: grant })
        }
        setBoot('ready')
      } catch (err: unknown) {
        console.error(err)
        useGameStore.setState({ error: 'Failed to load expedition.' })
        setBoot('auth')
      }
    })()
  }, [session, localId, boot])

  useEffect(() => {
    if (!ready || paused) return
    const id = window.setInterval(() => useGameStore.getState().tick(), TICK_MS)
    return () => window.clearInterval(id)
  }, [ready, paused])

  useEffect(() => {
    if (!ready) return
    const id = window.setInterval(() => {
      void useGameStore.getState().persistNow()
    }, PERSIST_MS)
    return () => window.clearInterval(id)
  }, [ready])

  useEffect(() => {
    const onHide = () => {
      const { player, items } = useGameStore.getState()
      if (player) void persistSave({ ...player, lastSettledAt: Date.now() }, items)
    }
    const onFocus = () => {
      const { player, items, ready: isReady } = useGameStore.getState()
      if (!isReady || !player) return
      useGameStore.getState().setPaused(true)
      void runSettlement(player, items).then(({ grant }) => {
        useGameStore.getState().hydrate(
          grant.player,
          grant.items,
          items.map((item) => item.id),
        )
        if (grant.kills > 0) useGameStore.setState({ offlineGrant: grant })
        useGameStore.getState().setPaused(false)
      })
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') onHide()
      if (document.visibilityState === 'visible') onFocus()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('beforeunload', onHide)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('beforeunload', onHide)
    }
  }, [])

  if (boot === 'auth') {
    return (
      <AuthScreen
        onLocal={() => {
          const id = newId()
          localStorage.setItem('idle-relic-expedition:guest', id)
          setLocalId(id)
          setBoot('loading')
        }}
      />
    )
  }

  if (boot !== 'ready' || !ready) {
    return (
      <div className="flex min-h-svh justify-center bg-black text-amber-100">
        <div className="grid h-svh w-full max-w-[430px] place-items-center bg-stone-950">
          <p className="text-sm uppercase tracking-widest">Opening the expedition…</p>
        </div>
      </div>
    )
  }

  return (
    <Shell>
      {screen === 'combat' && <CombatScreen />}
      {screen === 'character' && <CharacterScreen />}
      {screen === 'inventory' && <InventoryScreen />}
      {screen === 'skills' && <SkillTreeScreen />}
    </Shell>
  )
}
