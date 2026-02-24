'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Smartphone, 
  BarChart3, 
  Users, 
  Settings,
  ShieldCheck
} from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const menuItems = [
    { name: 'Panel General', icon: <LayoutDashboard size={20}/>, path: '/' },
    { name: 'Terminales Activas', icon: <Smartphone size={20}/>, path: '/dispositivos' },
    { name: 'Inteligencia BI', icon: <BarChart3 size={20}/>, path: '/analitica' },
    { name: 'Concesionarios', icon: <Users size={20}/>, path: '/concesionarios' },
  ]

  return (
    <aside className="w-64 bg-black border-r border-neutral-800 flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-12">
          <div className="bg-red-600 p-2 rounded-lg text-white font-black italic shadow-[0_0_15px_rgba(220,38,38,0.5)]">
            CT
          </div>
          <h2 className="text-white font-black italic tracking-tighter uppercase text-xl">
            Cruci <span className="text-red-600">Track</span>
          </h2>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
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

      <div className="mt-auto p-8 border-t border-neutral-900">
        <div className="flex items-center gap-3 text-neutral-600">
          <ShieldCheck size={16} />
          <span className="text-[9px] font-black uppercase tracking-widest italic">Modo Administrador</span>
        </div>
      </div>
    </aside>
  )
}