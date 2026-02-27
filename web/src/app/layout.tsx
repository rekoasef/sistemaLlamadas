import './globals.css'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'

export const metadata: Metadata = {
  title: 'CRUCI TRACK | Dashboard',
  description: 'Sistema de monitoreo de red Crucianelli',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="flex bg-black min-h-screen" suppressHydrationWarning>
        <Sidebar />
        <main className="flex-1 ml-10 p-10 bg-black">
          {children}
        </main>
      </body>
    </html>
  )
}