import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Cruci Track - CRM de Posventa',
  description: 'Sistema de monitoreo de flota Crucianelli',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#0a0a0a] text-white`}>
        {children}
      </body>
    </html>
  )
}