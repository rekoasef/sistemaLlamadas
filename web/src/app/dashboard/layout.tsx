'use client'
import { supabase } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { LayoutDashboard, Users, LogOut, Smartphone } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const menuItems = [
    { label: 'Panel General', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Dispositivos', icon: Smartphone, href: '/dashboard/dispositivos' },
    { label: 'Concesionarios', icon: Users, href: '/dashboard/concesionarios' },
  ]

  return (
    <div className="flex h-screen bg-[#0a0a0a] overflow-hidden">
      {/* Sidebar Fijo */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col flex-shrink-0">
        <div className="p-6">
          <span className="text-[10px] font-bold tracking-[0.3em] text-red-600 uppercase">Crucianelli</span>
          <h2 className="text-xl font-black tracking-tighter text-white italic">CRUCI TRACK</h2>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {menuItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 w-full px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                  isActive 
                    ? 'bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)]' 
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                <item.icon size={18} /> 
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-neutral-800">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-500 hover:text-red-500 transition-all"
          >
            <LogOut size={18} /> Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/30 flex items-center justify-between px-8 flex-shrink-0">
          <h2 className="text-sm font-semibold text-neutral-400 italic uppercase">
            Estado del Sistema: <span className="text-green-500 font-bold ml-2 tracking-widest">En Línea</span>
          </h2>
          <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">RA</div>
        </header>
        
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}