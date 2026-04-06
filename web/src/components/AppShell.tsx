'use client'

import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
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
 * Desktop: Sidebar always visible on the left.
 * Mobile (<768px): top navbar with hamburger that opens a slide-over drawer.
 */
export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname()
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  const isAuthPage = pathname === '/login'
  /** Wallboard and map are full-screen TV views — no sidebar or padding. */
  const isFullScreen = pathname === '/dashboard-planta' || pathname === '/mapa'

  if (isAuthPage || isFullScreen) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-black">
      {/* ── Desktop sidebar — always visible ── */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* ── Mobile drawer backdrop ── */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile slide-over drawer ── */}
      <div
        className={`fixed inset-y-0 left-0 z-50 md:hidden transition-transform duration-300 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onClose={() => setIsMobileOpen(false)} />
      </div>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top navbar */}
        <header className="flex md:hidden items-center justify-between px-4 py-3 bg-[#0F0F0F] border-b border-neutral-800 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 px-2 py-1 rounded-lg text-white font-black italic text-sm shadow-[0_0_12px_rgba(220,38,38,0.5)]">
              CT
            </div>
            <span className="text-white font-black italic tracking-tighter uppercase text-base">
              Cruci <span className="text-red-600">Track</span>
            </span>
          </div>
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-2 rounded-xl text-red-500 hover:bg-neutral-900 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={22} />
          </button>
        </header>

        <main className="flex-1 p-4 md:ml-10 md:p-10 bg-[#0F0F0F] overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
