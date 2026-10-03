import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useState, type FormEvent } from 'react'

type Props = {
  onLocal: () => void
}

export function AuthScreen({ onLocal }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage(null)
    const fn = mode === 'signin' ? supabase.auth.signInWithPassword : supabase.auth.signUp
    const { error } = await fn({ email, password })
    setBusy(false)
    if (error) setMessage(error.message)
    else if (mode === 'signup') setMessage('Check your email if confirmation is enabled, then sign in.')
  }

  return (
    <div className="flex min-h-svh justify-center bg-black px-0 text-stone-100">
      <div className="flex h-svh w-full max-w-[430px] flex-col justify-center bg-stone-950 px-5 shadow-[0_0_80px_rgba(0,0,0,0.65)]">
      <div className="w-full rounded-2xl border border-amber-900/40 bg-stone-900/80 p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-500/80">Idle RPG</p>
        <h1 className="mt-2 font-serif text-3xl text-amber-100">Idle Relic Expedition</h1>
        <p className="mt-3 text-sm text-stone-400">
          Auto-hunt through three realms, gear up, and carve a path through an overwhelming skill tree.
        </p>
        {supabaseConfigured ? (
          <form className="mt-6 space-y-3" onSubmit={onSubmit}>
            <input
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="w-full rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 text-sm"
              type="password"
              required
              minLength={6}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="w-full rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-amber-50 hover:bg-amber-600 disabled:opacity-60"
              disabled={busy}
              type="submit"
            >
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
            <button
              type="button"
              className="w-full text-xs text-stone-400 underline"
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            >
              {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
            </button>
            {message && <p className="text-xs text-amber-300">{message}</p>}
          </form>
        ) : (
          <p className="mt-6 text-sm text-stone-400">
            Add <code className="text-amber-200">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-200">VITE_SUPABASE_ANON_KEY</code> for cloud saves. You can still play locally.
          </p>
        )}
        <button
          type="button"
          className="mt-4 w-full rounded-lg border border-amber-800/70 px-3 py-2 text-sm text-amber-100 hover:bg-amber-950"
          onClick={onLocal}
        >
          Play local expedition
        </button>
      </div>
      </div>
    </div>
  )
}
