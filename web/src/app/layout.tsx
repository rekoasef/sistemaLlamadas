import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import AppShell from '@/components/AppShell'

export const metadata: Metadata = {
  title: 'CRUCI TRACK | Auditoría de Telemetría',
  description: 'Sistema de auditoría de red de concesionarios Crucianelli',
}

/**
 * Root Layout — Server Component.
 *
 * Deliberately minimal: it wraps the entire app in AppShell, which is a
 * thin client component that conditionally renders the Sidebar.
 * The /login page gets a full-screen treatment (no Sidebar).
 */
export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-black min-h-screen" suppressHydrationWarning>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
