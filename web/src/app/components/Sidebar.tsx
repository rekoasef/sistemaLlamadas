'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Smartphone, Users, LogOut } from 'lucide-react'

export default function Sidebar() {
  const pathname = usePathname()

  const menuItems = [
    { label: 'Panel General', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Dispositivos', icon: Smartphone, href: '/dispositivos' },
    { label: 'Concesionarios', icon: Users, href: '/concesionarios' },
  ]

  return (
    <div className="h-full flex flex-col bg-black border-r border-neutral-900 p-6">
      {/* LOGO */}
      <div className="mb-12">
        <p className="text-red-600 text-[10px] font-black tracking-[0.3em] uppercase">Crucianelli</p>
        <h1 className="text-2xl font-black italic text-white tracking-tighter">CRUCI TRACK</h1>
      </div>

      {/* MENU */}
      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-red-600 text-white shadow-[0_10px_20px_rgba(220,38,38,0.2)]' 
                  : 'text-neutral-500 hover:bg-neutral-900 hover:text-white'
              }`}
            >
              <item.icon size={20} className={isActive ? 'text-white' : 'group-hover:text-red-500'} />
              <span className="text-sm font-bold uppercase tracking-widest">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* LOGOUT */}
      <button className="flex items-center gap-4 px-4 py-3 text-neutral-600 hover:text-red-500 transition-colors mt-auto border-t border-neutral-900 pt-6">
        <LogOut size={20} />
        <span className="text-sm font-bold uppercase tracking-widest">Cerrar Sesión</span>
      </button>
    </div>
  )
}