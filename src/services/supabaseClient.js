// Cliente único do Supabase. Usa SOMENTE a anon key (pública).
// A segurança real está nas policies de RLS do banco.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(url && anonKey)
export const SUPABASE_URL = (url || 'https://configure-o-env.supabase.co').replace(/\/$/, '')
export const SUPABASE_ANON_KEY = anonKey || 'anon-key-ausente'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

// Lança o erro do Supabase (para usar com try/catch nos hooks)
export function unwrap({ data, error, count }) {
  if (error) throw error
  return count !== undefined && count !== null ? { data, count } : data
}
