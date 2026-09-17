import { createClient } from '@supabase/supabase-js'

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '/api'
const supabaseUrl = envUrl.startsWith('http')
  ? envUrl
  : typeof window !== 'undefined'
    ? `${window.location.origin}${envUrl.startsWith('/') ? '' : '/'}${envUrl}`
    : 'http://localhost:8000'

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Supabase URL or anon key missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
