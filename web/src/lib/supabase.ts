import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('⚠️ [Cruci-Track] Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

const isBrowser = typeof window !== 'undefined'

/**
 * Typed Supabase client for Cruci-Track.
 * Generic parameter <Database> enables end-to-end type inference
 * on every .from(), .select(), .insert(), .update() call.
 *
 * En el browser usa `createBrowserClient` de @supabase/ssr para leer la sesión
 * desde las cookies que escriben el login y el middleware. Sin esto las queries
 * viajan como rol `anon` y RLS rechaza todo INSERT/UPDATE con el código 42501.
 *
 * En el servidor (route handlers de cron, que corren sin sesión de usuario) se
 * mantiene el cliente anon plano: createBrowserClient depende de document.cookie.
 */
export const supabase = isBrowser
  ? createBrowserClient<Database>(supabaseUrl, supabaseAnonKey)
  : createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
