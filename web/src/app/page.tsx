'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  UserPlus,
  Monitor,
  RefreshCw,
  Clock
} from 'lucide-react'
import ModalVincular from '@/components/ModalVincular'

export default function DashboardPage() {
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [selectedNum, setSelectedNum] = useState('')
  const [eventFlash, setEventFlash] = useState(false)

  const vendorsRef = useRef<any[]>([])
  const syncTimeout = useRef<NodeJS.Timeout | null>(null)

  // =============================
  // FETCH BASE (SINCRONIZACIÓN REAL)
  // =============================
  const fetchLlamadas = useCallback(async () => {
    try {
      const { data: calls } = await supabase
        .from('llamadas')
        .select('*')
        .order('fecha_llamada', { ascending: false })
        .limit(50)

      const { data: vendors } = await supabase
        .from('concesionarios')
        .select('nombre, telefono_principal')

      vendorsRef.current = vendors || []

      const procesadas = (calls || []).map((ll: any) => {
        const found = vendorsRef.current.find(
          v => v.telefono_principal === ll.numero_telefono
        )
        return { ...ll, nombre_concesionario: found?.nombre || null }
      })

      setLlamadas(procesadas)
    } catch (err) {
      console.error('Error sync:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // =============================
  // REALTIME
  // =============================
  useEffect(() => {
    fetchLlamadas()

    const channel = supabase
      .channel('realtime-llamadas-pro')

      // 🔥 INSERT
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'llamadas' },
        (payload) => {
          const nueva = payload.new

          const found = vendorsRef.current.find(
            v => v.telefono_principal === nueva.numero_telefono
          )

          const llamadaProcesada = {
            ...nueva,
            nombre_concesionario: found?.nombre || null
          }

          // Optimistic insert + orden correcto
          setLlamadas(prev => {
            const actualizadas = [llamadaProcesada, ...prev]

            const ordenadas = actualizadas.sort((a, b) =>
              new Date(b.fecha_llamada).getTime() -
              new Date(a.fecha_llamada).getTime()
            )

            return ordenadas.slice(0, 50)
          })

          setEventFlash(true)
          setTimeout(() => setEventFlash(false), 2000)

          // 🔄 Sync silencioso (evita desfasajes)
          if (syncTimeout.current) clearTimeout(syncTimeout.current)
          syncTimeout.current = setTimeout(() => {
            fetchLlamadas()
          }, 1500)
        }
      )

      // 🔄 UPDATE (ej: cambia estado)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'llamadas' },
        (payload) => {
          const updated = payload.new

          setLlamadas(prev =>
            prev.map(ll =>
              ll.id === updated.id ? { ...ll, ...updated } : ll
            )
          )
        }
      )

      .subscribe((status) => {
        console.log('Realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchLlamadas])

  // =============================
  // KPIs
  // =============================
  const total = llamadas.length
  const atendidas = llamadas.filter(
    l => l.estado?.toUpperCase() === 'ATENDIDA'
  ).length

  const tasaExito =
    total > 0 ? Math.round((atendidas / total) * 100) : 0

  const perdidas = llamadas.filter(
    l => ['PERDIDA', 'RECHAZADA'].includes(l.estado?.toUpperCase() || '')
  ).length

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">

      {showModal && (
        <ModalVincular
          numero={selectedNum}
          onClose={() => setShowModal(false)}
          onSuccess={fetchLlamadas}
        />
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-neutral-800 pb-8 gap-4">
        <div>
          <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">
            PANEL <span className="text-red-600">GENERAL</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span
              className={`h-2 w-2 rounded-full ${
                eventFlash
                  ? 'bg-red-600 animate-ping'
                  : 'bg-green-500 animate-pulse'
              }`}
            />
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] italic">
              {eventFlash
                ? 'RECIBIENDO DATOS...'
                : 'SISTEMA CRUCI TRACK ONLINE'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchLlamadas}
          className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl hover:border-red-600 transition-all group"
        >
          <RefreshCw
            size={20}
            className={`text-neutral-500 group-hover:text-red-600 ${
              loading ? 'animate-spin' : ''
            }`}
          />
        </button>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Tráfico Total" value={total} sub="Llamadas" />
        <StatCard label="Eficiencia" value={`${tasaExito}%`} color="text-green-500" bar progress={tasaExito} />
        <StatCard label="Incidencias" value={perdidas} color="text-red-600" sub="Perdidas" />
      </div>

      {/* TABLA */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="px-10 py-8 border-b border-neutral-800/50 bg-neutral-900/50 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white flex items-center gap-3 italic">
            <Clock size={16} className="text-red-600" /> Registro de Actividad
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-neutral-600 border-b border-neutral-800/50">
                <th className="px-10 py-5">Sentido</th>
                <th className="px-10 py-5">Entidad / Concesionario</th>
                <th className="px-10 py-5 text-center">Estado</th>
                <th className="px-10 py-5 text-right">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/30">
              {llamadas.map((ll) => (
                <tr key={ll.id} className="hover:bg-red-600/[0.03] transition-all group">
                  <td className="px-10 py-6">
                    <div className={`flex items-center gap-3 font-black italic text-xs uppercase ${
                      ll.tipo_llamada === 'ENTRANTE'
                        ? 'text-blue-500'
                        : 'text-purple-500'
                    }`}>
                      {ll.tipo_llamada === 'ENTRANTE'
                        ? <PhoneIncoming size={18} />
                        : <PhoneOutgoing size={18} />}
                      {ll.tipo_llamada}
                    </div>
                  </td>

                  <td className="px-10 py-6">
                    {ll.nombre_concesionario ? (
                      <div className="flex flex-col">
                        <span className="text-white font-black italic uppercase text-xl group-hover:text-red-500 transition-colors leading-none">
                          {ll.nombre_concesionario}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-mono italic mt-1">
                          {ll.numero_telefono}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="text-neutral-500 font-mono text-sm italic">
                          {ll.numero_telefono}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedNum(ll.numero_telefono)
                            setShowModal(true)
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-red-600 hover:bg-red-600 hover:text-white transition-all text-[9px] font-black uppercase"
                        >
                          <UserPlus size={12} /> Vincular
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="px-10 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase border tracking-widest ${
                      ll.estado?.toUpperCase() === 'ATENDIDA'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-red-600/10 text-red-600 border-red-600/20'
                    }`}>
                      {ll.estado}
                    </span>
                  </td>

                  <td className="px-10 py-6 text-right">
                    <div className="flex flex-col items-end leading-none">
                      <span className="text-white font-black italic text-sm tracking-tight">
                        {ll.fecha_llamada
                          ? new Date(ll.fecha_llamada).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: '2-digit'
                            }) +
                            ' · ' +
                            new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })
                          : '--/-- · --:--'}
                      </span>
                      <div className="flex items-center gap-1 text-[9px] font-black text-neutral-600 uppercase italic mt-1">
                        <Monitor size={10} className="text-red-600" /> {ll.dispositivo_id}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  sub = "",
  color = "text-white",
  bar = false,
  progress = 0
}: any) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[2.5rem] relative overflow-hidden">
      <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-4 italic">
        {label}
      </p>

      <div className="flex items-baseline gap-3">
        <h2 className={`text-7xl font-black italic tracking-tighter ${color}`}>
          {value}
        </h2>
        {sub && (
          <span className="text-neutral-600 text-[10px] font-bold uppercase italic tracking-widest">
            {sub}
          </span>
        )}
      </div>

      {bar && (
        <div className="w-full bg-neutral-800/50 h-1.5 mt-8 rounded-full overflow-hidden">
          <div
            className="bg-red-600 h-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}