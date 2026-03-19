import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/supabase'

/**
 * Browser-side Supabase client for auth operations in Client Components.
 *
 * Uses `@supabase/ssr` instead of `@supabase/supabase-js` so that the session
 * is stored in cookies (not localStorage), making it readable by the middleware
 * and server components for proper SSR session hydration.
 *
 * Use this ONLY for auth flows (signIn, signOut, getUser).
 * Use the existing `@/lib/supabase` client for data queries.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
