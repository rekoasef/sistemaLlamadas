import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cruci-Track Route Protection Middleware
 *
 * Uses the @supabase/ssr v0.4+ getAll/setAll cookie API.
 * This is CRITICAL to avoid HTTP 431 (Request Header Fields Too Large):
 *
 *   - Old get/set/remove API: rebuilds the request object on every cookie mutation,
 *     which can double-append the large Supabase JWT cookie to the Cookie header.
 *   - New getAll/setAll API: batches all cookie writes into a single pass,
 *     keeping the Cookie header size stable.
 *
 * Session validation uses getUser() (server-side JWT verify) instead of
 * getSession() (client-cache only) for proper security.
 */
export async function middleware(request: NextRequest) {
  // Create the initial response — will be replaced if cookies need updating
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        /**
         * Read all cookies from the incoming request.
         * getAll() is the v0.4+ batch API that prevents header bloat.
         */
        getAll() {
          return request.cookies.getAll()
        },
        /**
         * Write all updated cookies to BOTH the request (so Server Components
         * downstream see the fresh session) and the response (so the browser
         * stores the refreshed token).
         */
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do NOT add any logic between createServerClient and getUser().
  // getUser() refreshes the session if needed — it must run unconditionally
  // so the cookie refresh cycle works correctly.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isLoginPage = pathname === '/login'

  // ── Guard: unauthenticated → /login ──────────────────────────────────────
  if (!user && !isLoginPage) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // ── Guard: authenticated → skip login page ────────────────────────────────
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Return the response with refreshed session cookies
  return supabaseResponse
}

/**
 * Matcher: run middleware on all routes except:
 * - Next.js internals (_next/*)
 * - Static assets (images, fonts, icons)
 * - API routes (if any)
 */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
