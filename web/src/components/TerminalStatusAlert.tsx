'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldAlert } from 'lucide-react'

interface TerminalStatus {
  terminal_id: string
  status: string
  last_seen: string
}

// Solo alertar si los permisos fueron revocados — eso es lo crítico
function esCritico(t: TerminalStatus): boolean {
  return t.status === 'SIN_PERMISOS'
}

export default function TerminalStatusAlert() {
  const [alertas, setAlertas] = useState<TerminalStatus[]>([])

  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase
        .from('terminal_status')
        .select('terminal_id, status, last_seen')

      if (data) {
        setAlertas(data.filter(esCritico))
      }
    }

    fetchStatus()

    const channel = supabase
      .channel('terminal-status-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terminal_status' }, () => fetchStatus())
      .subscribe()

    const interval = setInterval(fetchStatus, 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [])

  if (alertas.length === 0) return null

  return (
    <div className="flex flex-col gap-1 px-4 pt-2 md:px-10">
      {alertas.map(t => (
        <div
          key={t.terminal_id}
          className="flex items-center gap-2 rounded-lg border border-red-600/60 bg-red-950/40 px-3 py-2 text-xs text-red-400"
        >
          <ShieldAlert size={13} className="shrink-0" />
          <span>
            <span className="font-bold">Terminal {t.terminal_id}</span>
            {' — permisos de llamadas revocados. Las llamadas NO se están registrando.'}
          </span>
        </div>
      ))}
    </div>
  )
}
