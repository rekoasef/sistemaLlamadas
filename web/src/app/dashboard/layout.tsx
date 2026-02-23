'use client'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Phone, LayoutDashboard, Users, LogOut, Smartphone } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar Lateral */}
      <aside className="w-64 border-r border-neutral-800 bg-neutral-900/50 flex flex-col">
        <div className="p-6">
          <span className="text-[10px] font-bold tracking-[0.3em] text-red-600 uppercase">Crucianelli</span>
          <h2 className="text-xl font-black tracking-tighter text-white italic">CRUCI TRACK</h2>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-white bg-red-600 rounded-lg">
            <LayoutDashboard size={18} /> Panel General
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all">
            <Smartphone size={18} /> Dispositivos
          </button>
          <button className="flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-all">
            <Users size={18} /> Concesionarios
          </button>
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

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b border-neutral-800 bg-neutral-900/30 flex items-center justify-between px-8">
          <h2 className="text-sm font-semibold text-neutral-400">Estado del Sistema: <span className="text-green-500">En Línea</span></h2>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-xs font-bold">
              RA
            </div>
          </div>
        </header>
        
        <section className="p-8 overflow-y-auto">
          {children}
        </section>
      </main>
    </div>
  )
}