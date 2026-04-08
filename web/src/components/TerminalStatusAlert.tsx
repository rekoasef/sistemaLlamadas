'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { WifiOff, ShieldAlert } from 'lucide-react'

interface TerminalStatus {
  terminal_id: string
  status: string
  last_seen: string
}

const OFFLINE_THRESHOLD_MS = 45 * 60 * 1000

function resolveStatus(t: TerminalStatus): 'SIN_PERMISOS' | 'OFFLINE' | 'OK' {
  if (t.status === 'SIN_PERMISOS') return 'SIN_PERMISOS'
  if (t.status === 'OFFLINE' || Date.now() - new Date(t.last_seen).getTime() > OFFLINE_THRESHOLD_MS) return 'OFFLINE'
  return 'OK'
}

function formatMinutes(lastSeen: string): string {
  const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  return `hace ${hrs}h`
}

export default function TerminalStatusAlert() {
  const [alertas, setAlertas] = useState<TerminalStatus[]>([])

  useEffect(() => {
    async function fetchStatus() {
      const { data } = await supabase
        .from('terminal_status')
        .select('terminal_id, status, last_seen')

      if (data) {
        setAlertas(data.filter(t => resolveStatus(t) !== 'OK'))
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
      {alertas.map(t => {
        const estado = resolveStatus(t)
        const sinPermisos = estado === 'SIN_PERMISOS'

        return (
          <div
            key={t.terminal_id}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${
              sinPermisos
                ? 'border-red-600/60 bg-red-950/40 text-red-400'
                : 'border-yellow-600/40 bg-yellow-950/30 text-yellow-400'
            }`}
          >
            {sinPermisos
              ? <ShieldAlert size={13} className="shrink-0" />
              : <WifiOff size={13} className="shrink-0" />
            }
            <span>
              <span className="font-bold">Terminal {t.terminal_id}</span>
              {sinPermisos
                ? ' — permisos de llamadas revocados. Las llamadas NO se están registrando.'
                : <> {' — sin actividad '}<span className="opacity-70">{formatMinutes(t.last_seen)}</span>. No se están registrando llamadas.</>
              }
            </span>
          </div>
        )
      })}
    </div>
  )
}
