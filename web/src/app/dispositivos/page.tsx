'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Monitor, Edit3, Save, X, Activity, Smartphone, WifiOff, ShieldAlert } from 'lucide-react'

const OFFLINE_THRESHOLD_MS = 20 * 60 * 1000

type TerminalEstado = 'ONLINE' | 'SIN_PERMISOS' | 'OFFLINE' | 'DESCONOCIDO'

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

  // DESCONOCIDO: nunca envió heartbeat
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-neutral-600" />
      <span className="text-[9px] font-black text-neutral-600 uppercase tracking-widest">Sin datos</span>
    </div>
  )
}

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<any[]>([])
  const [aliasList, setAliasList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Obtener todos los IDs únicos de dispositivos que han llamado
    const { data: llamadas } = await supabase
      .from('llamadas')
      .select('dispositivo_id')

    const uniqueIds = Array.from(new Set(llamadas?.map(l => l.dispositivo_id)))

    // 2. Obtener los alias existentes
    const { data: aliasData } = await supabase
      .from('dispositivo_alias')
      .select('*')

    // 3. Obtener estado real de terminales
    const { data: statusData } = await supabase
      .from('terminal_status')
      .select('terminal_id, status, last_seen')

    setAliasList(aliasData || [])

    // 4. Cruzar datos para el panel
    const list = uniqueIds.map(id => {
      const aliasObj = aliasData?.find(a => a.dispositivo_id === id)
      const statusObj = statusData?.find(s => s.terminal_id === id)
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
                    onClick={() => { setEditingId(d.id); setNewAlias(d.alias); }}
                    className="p-2 text-neutral-500 hover:text-white transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="p-2 text-neutral-500 hover:text-red-600"><X size={18}/></button>
                    <button onClick={() => saveAlias(d.id)} className="p-2 text-green-500 hover:text-green-400"><Save size={18}/></button>
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
                      <span className="text-red-600/60">
                        <Monitor size={11} />
                      </span>
                      <p className="text-neutral-400 font-mono text-[11px] tracking-[0.15em]">{d.id}</p>
                    </div>
                    <p className="text-neutral-700 font-mono text-[9px] mt-0.5 tracking-[0.2em] uppercase">Línea telefónica</p>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
                <TerminalStatusBadge status={d.status} lastSeen={d.lastSeen} />
                <Activity size={16} className="text-neutral-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}