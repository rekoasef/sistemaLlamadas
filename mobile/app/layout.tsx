import Sidebar from '@/components/Sidebar'
import './globals.css'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-black text-white flex h-screen overflow-hidden">
        {/* SIDEBAR FIJO */}
        <aside className="w-64 border-r border-neutral-800 flex-shrink-0">
          <Sidebar />
        </aside>

        {/* CONTENIDO SCROLLABLE */}
        <main className="flex-1 overflow-y-auto p-8 bg-[#0a0a0a]">
          {children}
        </main>
      </body>
    </html>
  )
