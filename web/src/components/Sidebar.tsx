'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Tablet, Users, LogOut } from 'lucide-react'

const menuItems = [
  { name: 'Panel General', href: '/', icon: LayoutDashboard },
  { name: 'Dispositivos', href: '/dispositivos', icon: Tablet },
  { name: 'Concesionarios', href: '/concesionarios', icon: Users },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="w-64 bg-neutral-900 border-r border-neutral-800 h-screen flex flex-col p-6 fixed left-0 top-0">
      <div className="mb-10 px-2">
        <h2 className="text-red-600 font-black italic text-2xl tracking-tighter">CRUCI TRACK</h2>
        <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-[0.3em]">Posventa Industrial</p>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold uppercase text-[10px] tracking-widest ${
                isActive ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300'
              }`}
            >
              <Icon size={18} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="pt-6 border-t border-neutral-800">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-neutral-500 hover:text-red-500 transition-colors font-bold uppercase text-[10px] tracking-widest">
          <LogOut size={18} />
          Cerrar Sesión
        </button>
      </div>
    </div>
  )
}