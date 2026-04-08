'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Monitor, Edit3, Save, X, Activity, Smartphone, WifiOff, ShieldAlert, History, ArrowRight } from 'lucide-react'

const OFFLINE_THRESHOLD_MS = 45 * 60 * 1000

type TerminalEstado = 'ONLINE' | 'SIN_PERMISOS' | 'OFFLINE' | 'DESCONOCIDO'

interface HistorialEntry {
  id: number
  terminal_id: string
  status_previo: string | null
  status_nuevo: string
  created_at: string
}

function resolveEstado(status: string | undefined, lastSeen: string | undefined): TerminalEstado {
  if (!status || !lastSeen) return 'DESCONOCIDO'
  if (status === 'SIN_PERMISOS') return 'SIN_PERMISOS'
  if (status === 'OFFLINE' || Date.now() - new Date(lastSeen).getTime() > OFFLINE_THRESHOLD_MS) return 'OFFLINE'
  return 'ONLINE'
}

function formatLastSeen(lastSeen: string | undefined): string {
  if (!lastSeen) return ''
  const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000)
  if (mins < 1) return 'hace menos de 1 min'
  if (mins < 60) return `hace ${mins} min`
  return `hace ${Math.floor(mins / 60)}h`
}

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

const ESTADO_LABEL: Record<string, string> = {
  ONLINE:       'En línea',
  OFFLINE:      'Sin conexión',
  SIN_PERMISOS: 'Sin permisos',
}

const ESTADO_COLOR: Record<string, string> = {
  ONLINE:       'text-green-400',
  OFFLINE:      'text-yellow-400',
  SIN_PERMISOS: 'text-red-400',
}

function estadoLabel(s: string | null) {
  return s ? (ESTADO_LABEL[s] ?? s) : '—'
}

function estadoColor(s: string | null) {
  return s ? (ESTADO_COLOR[s] ?? 'text-neutral-400') : 'text-neutral-600'
}

function TerminalStatusBadge({ status, lastSeen }: { status?: string; lastSeen?: string }) {
  const estado = resolveEstado(status, lastSeen)

  if (estado === 'ONLINE') {
    return (
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">En Línea</span>
      </div>
    )
  }

  if (estado === 'SIN_PERMISOS') {
    return (
      <div className="flex items-center gap-2">
        <ShieldAlert size={12} className="text-red-500" />
        <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Sin permisos</span>
      </div>
    )
  }

  if (estado === 'OFFLINE') {
    return (
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <WifiOff size={12} className="text-yellow-500" />
          <span className="text-[9px] font-black text-yellow-500 uppercase tracking-widest">Sin conexión</span>
        </div>
        {lastSeen && (
          <span className="text-[8px] text-neutral-600 tracking-wide ml-4">{formatLastSeen(lastSeen)}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-neutral-600" />
      <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Sin datos</span>
    </div>
  )
}

function HistorialModal({
  terminalId,
  alias,
  onClose,
}: {
  terminalId: string
  alias: string
  onClose: () => void
}) {
  const [historial, setHistorial] = useState<HistorialEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('terminal_status_history')
        .select('*')
        .eq('terminal_id', terminalId)
        .order('created_at', { ascending: false })
        .limit(50)
      setHistorial(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [terminalId])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      <div
        className="relative z-10 w-full max-w-lg bg-neutral-950 border border-neutral-800 rounded-[2rem] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-neutral-800">
          <div>
            <h2 className="text-xl font-black italic uppercase text-white tracking-tighter">{alias}</h2>
            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-[0.3em] mt-0.5">Historial de estado</p>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* body */}
        <div className="max-h-[60vh] overflow-y-auto px-8 py-6 space-y-3">
          {loading && (
            <p className="text-neutral-600 text-xs text-center py-8">Cargando...</p>
          )}
          {!loading && historial.length === 0 && (
            <p className="text-neutral-600 text-xs text-center py-8">Sin cambios de estado registrados.</p>
          )}
          {historial.map(entry => (
            <div key={entry.id} className="flex items-start gap-4 py-3 border-b border-neutral-900 last:border-0">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`text-xs font-bold shrink-0 ${estadoColor(entry.status_previo)}`}>
                  {estadoLabel(entry.status_previo)}
                </span>
                <ArrowRight size={12} className="text-neutral-700 shrink-0" />
                <span className={`text-xs font-bold shrink-0 ${estadoColor(entry.status_nuevo)}`}>
                  {estadoLabel(entry.status_nuevo)}
                </span>
              </div>
              <span className="text-[10px] text-neutral-600 font-mono shrink-0 text-right">
                {formatFecha(entry.created_at)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')
  const [historialTerminal, setHistorialTerminal] = useState<{ id: string; alias: string } | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)

    const { data: llamadas } = await supabase
      .from('llamadas')
      .select('dispositivo_id')

    const uniqueIds = Array.from(new Set(llamadas?.map(l => l.dispositivo_id)))

    const { data: aliasData } = await supabase
      .from('dispositivo_alias')
      .select('*')

    const { data: statusData } = await supabase
      .from('terminal_status')
      .select('terminal_id, status, last_seen')

    const list = uniqueIds.map(id => {
      const aliasObj = aliasData?.find((a: any) => a.dispositivo_id === id)
      const statusObj = statusData?.find((s: any) => s.terminal_id === id)
      return {
        id,
        alias: aliasObj ? aliasObj.alias : `Terminal ${id}`,
        isRegistered: !!aliasObj,
        status: statusObj?.status,
        lastSeen: statusObj?.last_seen,
      }
    })

    setDispositivos(list)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()

    const channel = supabase
      .channel('dispositivos-terminal-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'terminal_status' }, fetchData)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchData])

  const saveAlias = async (dispositivoId: string) => {
    const { error } = await supabase
      .from('dispositivo_alias')
      .upsert({ dispositivo_id: dispositivoId, alias: newAlias }, { onConflict: 'dispositivo_id' })

    if (!error) {
      setEditingId(null)
      fetchData()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 pt-10 animate-in fade-in duration-700">

      <div className="border-b border-neutral-800 pb-8">
        <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
          GESTIÓN DE <span className="text-red-600">TERMINALES</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 italic">
          Asignación de nombres y puestos de red
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {dispositivos.map((d) => (
          <div key={d.id} className="group bg-neutral-900/40 border border-neutral-800 p-8 rounded-[2.5rem] hover:border-red-600/50 transition-all relative overflow-hidden">

            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <div className="p-4 bg-neutral-800 rounded-2xl text-red-600">
                  <Smartphone size={24} />
                </div>
                {editingId !== d.id ? (
                  <button
                    onClick={() => { setEditingId(d.id); setNewAlias(d.alias) }}
                    className="p-2 text-neutral-500 hover:text-white transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="p-2 text-neutral-500 hover:text-red-600"><X size={18} /></button>
                    <button onClick={() => saveAlias(d.id)} className="p-2 text-green-500 hover:text-green-400"><Save size={18} /></button>
                  </div>
                )}
              </div>

              <div>
                {editingId === d.id ? (
                  <input
                    autoFocus
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="w-full bg-black border border-red-600 rounded-xl p-3 text-white font-black italic uppercase text-xl outline-none"
                  />
                ) : (
                  <>
                    <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter">{d.alias}</h3>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-red-600/60"><Monitor size={11} /></span>
                      <p className="text-neutral-400 font-mono text-[11px] tracking-[0.15em]">{d.id}</p>
                    </div>
                    <p className="text-neutral-700 font-mono text-[9px] mt-0.5 tracking-[0.2em] uppercase">Línea telefónica</p>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-neutral-800 space-y-3">
                <div className="flex items-center justify-between">
                  <TerminalStatusBadge status={d.status} lastSeen={d.lastSeen} />
                  <Activity size={16} className="text-neutral-800" />
                </div>
                <button
                  onClick={() => setHistorialTerminal({ id: d.id, alias: d.alias })}
                  className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-neutral-600 hover:text-neutral-400 transition-colors"
                >
                  <History size={11} />
                  Historial de estado
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {historialTerminal && (
        <HistorialModal
          terminalId={historialTerminal.id}
          alias={historialTerminal.alias}
          onClose={() => setHistorialTerminal(null)}
        />
      )}
    </div>
  )
}
