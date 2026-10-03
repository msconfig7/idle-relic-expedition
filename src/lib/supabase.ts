import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(
  url && key && !url.includes('your-project') && !key.includes('your-anon'),
)

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url, key)
  : null
