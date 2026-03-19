'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useCallback } from 'react'
import {
  LayoutDashboard,
  Smartphone,
  BarChart3,
  Users,
  FileText,
  Tv2,
  ShieldCheck,
  LogOut,
  Loader2,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

interface NavItem {
  name: string
  icon: React.ReactNode
  path: string
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Panel General',      icon: <LayoutDashboard size={20} />, path: '/' },
  { name: 'Terminales Activas', icon: <Smartphone size={20} />,      path: '/dispositivos' },
  { name: 'Inteligencia BI',    icon: <BarChart3 size={20} />,       path: '/analitica' },
  { name: 'Concesionarios',     icon: <Users size={20} />,           path: '/concesionarios' },
  { name: 'Centro de Informes', icon: <FileText size={20} />,        path: '/informes' },
  { name: 'Wallboard TV',       icon: <Tv2 size={20} />,             path: '/dashboard-planta' },
]

/**
 * Application navigation sidebar.
 * - Active route highlighted in Crucianelli red.
 * - Logout button signs out via Supabase Auth and redirects to /login.
 * - Sticky positioning keeps it visible during content scroll.
 */
export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = useCallback(async () => {
    setSigningOut(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }, [router])

  return (
    <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col h-screen sticky top-0 shrink-0">
      <div className="p-8 flex-1 overflow-y-auto">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-red-600 p-2 rounded-lg text-white font-black italic shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            CT
          </div>
          <h2 className="text-white font-black italic tracking-tighter uppercase text-xl">
            Cruci <span className="text-red-600">Track</span>
          </h2>
        </div>

        {/* Navigation */}
        <nav className="space-y-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.path
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center gap-4 px-4 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest italic transition-all ${
                  isActive
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                    : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'
                }`}
              >
                {item.icon}
                {item.name}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Footer — admin badge + logout */}
      <div className="p-8 border-t border-neutral-900 space-y-4">
        <div className="flex items-center gap-3 text-neutral-600">
          <ShieldCheck size={16} />
          <span className="text-[9px] font-black uppercase tracking-widest italic">
            Modo Administrador
          </span>
        </div>

        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-neutral-600 hover:bg-neutral-900 hover:text-red-600 transition-all font-black uppercase text-[9px] tracking-widest italic disabled:opacity-40"
        >
          {signingOut ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LogOut size={16} />
          )}
          {signingOut ? 'Cerrando...' : 'Cerrar Sesión'}
        </button>
      </div>
    </aside>
  )
}
