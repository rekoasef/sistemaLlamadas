'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PhoneIncoming,
  PhoneOutgoing,
  Activity,
  UserPlus,
  Monitor,
  RefreshCw,
  Clock,
  Filter,
  Calendar as CalendarIcon
} from 'lucide-react'
import ModalVincular from '@/components/ModalVincular'

export default function DashboardPage() {
  // Estados de Datos
  const [llamadasRaw, setLlamadasRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false) 
  
  // Estados de Interfaz
  const [showModal, setShowModal] = useState(false)
  const [selectedNum, setSelectedNum] = useState('')
  const [eventFlash, setEventFlash] = useState(false)

  // Estados de Filtro
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroDispositivo, setFiltroDispositivo] = useState('TODOS')

  const vendorsRef = useRef<any[]>([])
  const syncTimeout = useRef<NodeJS.Timeout | null>(null)

  // =============================
  // FETCH DE DATOS (SIN CACHÉ)
  // =============================
const fetchLlamadas = useCallback(async () => {
  try {
    const { data: calls } = await supabase
      .from('llamadas')
      .select('*')
      .order('fecha_llamada', { ascending: false })
      .limit(100)

    const { data: vendors } = await supabase
      .from('concesionarios')
      .select('nombre, telefono_principal')

    vendorsRef.current = vendors || []

    console.log(`📊 Datos recibidos: ${calls?.length} filas.`)

    setLlamadasRaw(calls || [])
  } catch (err) {
    console.error('Error sync:', err)
  } finally {
    setLoading(false)
  }
}, [])

  // =============================
  // EFFECT PRINCIPAL Y REALTIME (CORREGIDO)
  // =============================
useEffect(() => {
  setMounted(true)
  fetchLlamadas()

  const channel = supabase
    .channel('llamadas-realtime')

    // INSERT
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'llamadas'
      },
      (payload) => {
        console.log('🟢 INSERT realtime:', payload.new)

        setLlamadasRaw(prev => {
          if (prev.find(l => l.id === payload.new.id)) return prev
          return [payload.new, ...prev]
        })

        setEventFlash(true)
        setTimeout(() => setEventFlash(false), 2000)
      }
    )

    // UPDATE
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'llamadas'
      },
      (payload) => {
        console.log('🟡 UPDATE realtime:', payload.new)

        setLlamadasRaw(prev =>
          prev.map(l =>
            l.id === payload.new.id ? payload.new : l
          )
        )
      }
    )

    .subscribe(status => {
      console.log('📡 Estado de conexión:', status)
    })

  return () => {
    supabase.removeChannel(channel)
  }
}, [])

  // =============================
  // LÓGICA DE FILTRADO (useMemo)
  // =============================
  const llamadasFiltradas = useMemo(() => {
    return llamadasRaw.filter(ll => {
      const matchDispositivo = filtroDispositivo === 'TODOS' || ll.dispositivo_id === filtroDispositivo
      const matchFecha = !filtroFecha || ll.fecha_llamada.startsWith(filtroFecha)
      return matchDispositivo && matchFecha
    }).map(ll => {
      const found = vendorsRef.current.find(v => v.telefono_principal === ll.numero_telefono)
      return { ...ll, nombre_concesionario: found?.nombre || null }
    })
  }, [llamadasRaw, filtroFecha, filtroDispositivo])

  const listaDispositivos = useMemo(() => {
    return Array.from(new Set(llamadasRaw.map(ll => ll.dispositivo_id))).filter(Boolean)
  }, [llamadasRaw])

  // KPIs
  const total = llamadasFiltradas.length
  const atendidas = llamadasFiltradas.filter(l => l.estado?.toUpperCase() === 'ATENDIDA').length
  const tasaExito = total > 0 ? Math.round((atendidas / total) * 100) : 0
  const perdidas = llamadasFiltradas.filter(l => ['PERDIDA', 'RECHAZADA'].includes(l.estado?.toUpperCase() || '')).length

  if (!mounted) return null

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">

      {showModal && (
        <ModalVincular
          numero={selectedNum}
          onClose={() => setShowModal(false)}
          onSuccess={fetchLlamadas}
        />
      )}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-neutral-800 pb-8 gap-6">
        <div>
          <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
            PANEL <span className="text-red-600">GENERAL</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className={`h-2 w-2 rounded-full ${eventFlash ? 'bg-red-600 animate-ping' : 'bg-green-500 animate-pulse'}`} />
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] italic">
              {eventFlash ? "SINCRONIZANDO DB..." : "RED CRUCIANELLI EN LÍNEA"}
            </p>
          </div>
        </div>

        {/* FILTROS */}
        <div className="flex flex-wrap items-center gap-4 bg-neutral-900/50 p-4 rounded-[2rem] border border-neutral-800 shadow-xl">
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-neutral-800">
            <CalendarIcon size={14} className="text-red-600" />
            <input 
              type="date" 
              className="bg-transparent text-white text-[10px] font-black uppercase outline-none"
              style={{ colorScheme: 'dark' }}
              onChange={(e) => setFiltroFecha(e.target.value)}
              value={filtroFecha}
            />
          </div>
          
          <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-xl border border-neutral-800">
            <Monitor size={14} className="text-red-600" />
            <select 
              className="bg-transparent text-white text-[10px] font-black uppercase outline-none cursor-pointer"
              onChange={(e) => setFiltroDispositivo(e.target.value)}
              value={filtroDispositivo}
            >
              <option value="TODOS" className="bg-neutral-900">TODOS LOS PUESTOS</option>
              {listaDispositivos.map(id => (
                <option key={id} value={id} className="bg-neutral-900">{id}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={() => { setFiltroFecha(''); setFiltroDispositivo('TODOS'); }}
            className="text-[9px] font-black text-neutral-500 hover:text-white uppercase transition-colors px-2"
          >
            Limpiar
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Volumen de Red" value={total} sub="Llamadas" />
        <StatCard label="Eficiencia" value={`${tasaExito}%`} color="text-green-500" bar progress={tasaExito} />
        <StatCard label="Incidencias" value={perdidas} color="text-red-600" sub="Perdidas" />
      </div>

      {/* TABLA */}
      <div className="bg-neutral-900/30 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="px-10 py-8 border-b border-neutral-800/50 bg-neutral-900/50 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white flex items-center gap-3 italic">
            <Filter size={16} className="text-red-600" /> 
            {filtroFecha || filtroDispositivo !== 'TODOS' ? 'Filtrado Activo' : 'Registro de Actividad'}
          </h3>
          <button onClick={fetchLlamadas} className="p-2 hover:bg-neutral-800 rounded-full transition-colors group">
            <RefreshCw size={16} className={`text-neutral-500 group-hover:text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-widest text-neutral-600 border-b border-neutral-800/50">
                <th className="px-10 py-5">Sentido</th>
                <th className="px-10 py-5">Entidad / Concesionario</th>
                <th className="px-10 py-5 text-center">Estado</th>
                <th className="px-10 py-5 text-right">Origen / Puesto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/30">
              {llamadasFiltradas.map((ll) => (
                <tr key={ll.id} className="hover:bg-red-600/[0.03] transition-all group">
                  <td className="px-10 py-6">
                    <div className={`flex items-center gap-3 font-black italic text-xs uppercase ${
                      ll.tipo_llamada === 'ENTRANTE' ? 'text-blue-500' : 'text-purple-500'
                    }`}>
                      {ll.tipo_llamada === 'ENTRANTE' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                      {ll.tipo_llamada}
                    </div>
                  </td>

                  <td className="px-10 py-6">
                    {ll.nombre_concesionario ? (
                      <div className="flex flex-col">
                        <span className="text-white font-black italic uppercase text-xl group-hover:text-red-500 transition-colors leading-none">
                          {ll.nombre_concesionario}
                        </span>
                        <span className="text-[10px] text-neutral-600 font-mono italic mt-1 uppercase tracking-tighter">
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
                          className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-red-600 hover:bg-red-600 hover:text-white transition-all text-[9px] font-black uppercase italic"
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
                          ? new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                          : '--:--'}
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

function StatCard({ label, value, sub = "", color = "text-white", bar = false, progress = 0 }: any) {
  return (
    <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[2.5rem] relative overflow-hidden group shadow-lg">
      <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-4 italic leading-none">
        {label}
      </p>

      <div className="flex items-baseline gap-3">
        <h2 className={`text-7xl font-black italic tracking-tighter transition-all group-hover:scale-105 ${color}`}>
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
            className="bg-red-600 h-full transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}