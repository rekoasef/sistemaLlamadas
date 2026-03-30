'use client'

import { usePathname } from 'next/navigation'
import Sidebar from '@/components/Sidebar'

interface AppShellProps {
  children: React.ReactNode
}

/**
 * AppShell — conditional layout wrapper.
 *
 * Renders the Sidebar + main content shell for all authenticated routes.
 * The /login route bypasses the shell entirely, rendering full-screen.
 *
 * Why a client component: `usePathname` is a client hook. The layout.tsx
 * itself remains a Server Component; only this thin wrapper is client-side.
 */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const isAuthPage = pathname === '/login'
  /** Wallboard and map are full-screen TV views — no sidebar or padding. */
  const isFullScreen = pathname === '/dashboard-planta' || pathname === '/mapa'

  if (isAuthPage || isFullScreen) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-black">
      <Sidebar />
      <main className="flex-1 ml-10 p-10 bg-black overflow-x-hidden">
        {children}
      </main>
    </div>
  )
}
