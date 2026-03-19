import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/supabase'

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 *
 * Uses the @supabase/ssr v0.4+ getAll/setAll batch cookie API to avoid
 * the HTTP 431 header-size issue caused by the old individual get/set/remove pattern.
 *
 * NOTE: Do NOT call this in middleware — use request.cookies there instead.
 */
export function createSupabaseServerClient() {
  const cookieStore = cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component where cookies() is read-only.
            // The middleware is responsible for keeping the session fresh.
          }
        },
      },
    }
  )
}
