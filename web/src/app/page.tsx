'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PhoneIncoming, PhoneOutgoing, Activity, UserPlus, Monitor, RefreshCw,
  Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, TrendingUp,
  ChevronLeft, ChevronRight, Zap, Clock, Wifi, AlertCircle, Hourglass
} from 'lucide-react'
import ModalVincular from '@/components/ModalVincular'

// ==========================================
// RELOJ DIGITAL Y FECHA (HEADER)
// ==========================================
function LiveClock() {
  const [time, setTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-neutral-800 backdrop-blur-xl group hover:border-red-600 transition-all min-w-[220px]">
      <Clock size={20} className="text-red-600 animate-pulse" />
      <div className="flex flex-col justify-center">
        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] leading-none mb-1">
          {mounted ? time.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : "--/--/----"}
        </span>
        <span className="text-white font-black italic text-base tracking-tighter leading-none uppercase">
          {mounted ? time.toLocaleTimeString('es-AR', { hour12: false }) : "--:--:--"} HS
        </span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [llamadasRaw, setLlamadasRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(20)
  const [showModal, setShowModal] = useState(false)
  const [selectedNum, setSelectedNum] = useState('')
  const [eventFlash, setEventFlash] = useState(false)
  const [filtroFecha, setFiltroFecha] = useState('')
  const [filtroDispositivo, setFiltroDispositivo] = useState('TODOS')

  const fetchLlamadas = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('llamadas')
      .select('*, concesionarios:concesionario_id (nombre)')
      .order('fecha_llamada', { ascending: false })
      .limit(200)
    setLlamadasRaw(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLlamadas()
    const channel = supabase.channel('dashboard-realtime-final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, async (payload) => {
        setEventFlash(true)
        setTimeout(() => setEventFlash(false), 2000)
        const id = payload.new ? (payload.new as any).id : (payload.old as any).id
        const { data: fullRow } = await supabase.from('llamadas').select('*, concesionarios:concesionario_id (nombre)').eq('id', id).single()
        if (fullRow) {
          setLlamadasRaw(prev => {
            const index = prev.findIndex(l => l.id === fullRow.id)
            if (index !== -1) {
              const newArr = [...prev]; newArr[index] = fullRow; return newArr
            }
            return [fullRow, ...prev].slice(0, 200)
          })
        }
      }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLlamadas])

  const filtradas = useMemo(() => {
    return llamadasRaw.filter(ll => {
      const matchDisp = filtroDispositivo === 'TODOS' || ll.dispositivo_id === filtroDispositivo
      const matchFecha = !filtroFecha || ll.fecha_llamada.startsWith(filtroFecha)
      return matchDisp && matchFecha
    })
  }, [llamadasRaw, filtroFecha, filtroDispositivo])

  const stats = useMemo(() => {
    let entrantes = 0, salientes = 0, auditadasTotal = 0, atendidasAuditadas = 0, perdidasComerciales = 0
    filtradas.forEach(l => {
      if (l.tipo_llamada === 'ENTRANTE') entrantes++
      else salientes++
      const hora = new Date(l.fecha_llamada).getHours()
      // Filtro Comercial (07:00 - 19:00) [cite: 74, 83]
      if (hora >= 7 && hora < 19) {
        auditadasTotal++
        if (l.estado === 'ATENDIDA') atendidasAuditadas++
        else perdidasComerciales++
      } else if (l.estado === 'ATENDIDA') {
        auditadasTotal++; atendidasAuditadas++
      }
    })
    const eficiencia = auditadasTotal > 0 ? Math.round((atendidasAuditadas / auditadasTotal) * 100) : 0
    return { total: filtradas.length, entrantes, salientes, eficiencia, perdidasComerciales }
  }, [filtradas])

  const paginadas = filtradas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
  const totalPages = Math.ceil(filtradas.length / itemsPerPage)

  const formatDuracion = (ll: any) => {
    const segundos = ll.duracion_segundos || 0; // [cite: 47, 79]
    if (segundos === 0) return '00:00';
    const mins = Math.floor(segundos / 60); // [cite: 88]
    const secs = segundos % 60; // [cite: 89]
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4 pt-10 ${eventFlash ? 'ring-1 ring-red-600/20' : ''}`}>
      {showModal && <ModalVincular numero={selectedNum} onClose={() => setShowModal(false)} onSuccess={fetchLlamadas} />}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-neutral-800 pb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-3 bg-red-600/10 w-fit px-4 py-1.5 rounded-full border border-red-600/20">
            <Wifi size={12} className="text-red-600 animate-pulse" />
            <span className="text-red-600 text-[9px] font-black uppercase tracking-widest italic">Live Telemetry Active</span>
          </div>
          <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
            PANEL <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]">GENERAL</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <LiveClock />
          <div className="flex items-center gap-4 bg-neutral-900/50 p-2 rounded-[2rem] border border-neutral-800 backdrop-blur-md">
            <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl border border-neutral-800 focus-within:border-red-600 transition-all">
              <CalendarIcon size={14} className="text-red-600" />
              <input type="date" className="bg-transparent text-white text-[10px] font-black uppercase outline-none" style={{ colorScheme: 'dark' }} onChange={e => setFiltroFecha(e.target.value)} value={filtroFecha} />
            </div>
            <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl border border-neutral-800 focus-within:border-red-600 transition-all">
              <Monitor size={14} className="text-red-600" />
              <select className="bg-transparent text-red-600 text-[10px] font-black uppercase outline-none cursor-pointer" onChange={e => setFiltroDispositivo(e.target.value)} value={filtroDispositivo}>
                <option value="TODOS">TODOS LOS PUESTOS</option>
                {Array.from(new Set(llamadasRaw.map(l => l.dispositivo_id))).map(id => <option key={id} value={id}>PUESTO {id}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[3.5rem] relative group overflow-hidden shadow-2xl transition-all hover:border-red-600/50 backdrop-blur-md">
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest italic mb-6">Volumen de Red</p>
          <div className="flex items-baseline gap-4 mb-10 group-hover:scale-105 transition-transform duration-500">
            <h2 className="text-8xl font-black italic text-white tracking-tighter">{stats.total}</h2>
            <span className="text-neutral-600 text-sm font-black uppercase italic tracking-widest">Total</span>
          </div>
          <div className="grid grid-cols-2 gap-8 border-t border-neutral-800 pt-8">
            <div className="flex items-center gap-3">
              <ArrowDownLeft className="text-blue-500" size={20} />
              <div><p className="text-white font-black italic text-2xl leading-none">{stats.entrantes}</p><p className="text-[9px] text-neutral-600 font-black uppercase">Entrantes</p></div>
            </div>
            <div className="flex items-center gap-3">
              <ArrowUpRight className="text-green-500" size={20} />
              <div><p className="text-white font-black italic text-2xl leading-none">{stats.salientes}</p><p className="text-[9px] text-neutral-600 font-black uppercase">Salientes</p></div>
            </div>
          </div>
        </div>
        <StatCard label="Ratio Eficiencia" value={`${stats.eficiencia}%`} color="text-green-500" bar progress={stats.eficiencia} sub="Franja 7-19hs" icon={<Zap size={40} className="opacity-10 group-hover:opacity-100 transition-opacity" />} />
        <StatCard label="Incidencias Críticas" value={stats.perdidasComerciales} color="text-red-600" icon={<AlertCircle size={40} className="opacity-20 group-hover:animate-bounce" />} sub="Perdidas (07-19hs)" glow />
      </div>

      {/* TABLA PRINCIPAL */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-[3.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
        <div className="px-12 py-10 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 rounded-2xl shadow-[0_0_15px_rgba(220,38,38,0.4)]"><Activity size={18} className="text-white animate-pulse" /></div>
            <div><h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic">Activity Stream</h3><p className="text-neutral-600 text-[9px] font-black uppercase mt-2 italic tracking-widest leading-none">Sync Automático</p></div>
          </div>
          <button onClick={fetchLlamadas} className="p-4 bg-neutral-800 hover:bg-red-600 rounded-2xl transition-all hover:rotate-180 duration-500"><RefreshCw size={20} className={loading ? 'animate-spin' : 'text-white'} /></button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 border-b border-neutral-800/50">
                <th className="px-12 py-6">Tipo / Estado</th>
                <th className="px-12 py-6">Identificación</th>
                <th className="px-12 py-6 text-center">Duración</th>
                <th className="px-12 py-6 text-center">Protocolo</th>
                <th className="px-12 py-6 text-right">Origen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/20">
              {paginadas.map((ll) => (
                <tr key={ll.id} className="hover:bg-red-600/[0.04] transition-all group">
                  <td className="px-12 py-8">
                    <div className="flex items-center gap-4">
                      <div className={`p-2.5 rounded-xl ${ll.tipo_llamada === 'ENTRANTE' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        {ll.tipo_llamada === 'ENTRANTE' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-white leading-none mb-1">{ll.tipo_llamada}</span>
                        <span className={`text-[8px] font-black uppercase italic ${ll.estado === 'ATENDIDA' ? 'text-green-500' : 'text-red-600'}`}>{ll.estado}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-12 py-8">
                    {ll.concesionarios?.nombre ? (
                      <div className="flex flex-col">
                        <span className="text-white font-black italic uppercase text-3xl group-hover:text-red-500 transition-colors leading-none tracking-tighter">{ll.concesionarios.nombre}</span>
                        <span className="text-[11px] text-neutral-600 font-mono italic mt-2 tracking-widest">{ll.numero_telefono}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-6">
                        <span className="text-neutral-500 font-mono text-lg italic tracking-widest">{ll.numero_telefono}</span>
                        <button onClick={() => { setSelectedNum(ll.numero_telefono); setShowModal(true); }} className="px-6 py-2.5 bg-neutral-800 border border-neutral-700 rounded-2xl text-red-600 hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase italic shadow-lg active:scale-95">Vincular</button>
                      </div>
                    )}
                  </td>
                  <td className="px-12 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2 text-white font-mono text-2xl font-bold tracking-tighter group-hover:text-red-600 transition-colors leading-none">
                        <Hourglass size={14} className="text-neutral-700" />
                        {formatDuracion(ll)}
                      </div>
                      <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest italic mt-1 leading-none">Minutos</span>
                    </div>
                  </td>
                  <td className="px-12 py-8 text-center">
                    <span className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest ${ll.estado?.toUpperCase() === 'ATENDIDA' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-600/10 text-red-600 border-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.2)]'}`}>{ll.estado}</span>
                  </td>
                  
                  {/* COLUMNA ORIGEN CORREGIDA: HORA ARRIBA, FECHA ABAJO */}
                  <td className="px-12 py-8 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span suppressHydrationWarning className="text-white font-black italic text-2xl tracking-tighter group-hover:text-red-500 transition-colors leading-none">
                        {new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit' })} HS
                      </span>
                      <span suppressHydrationWarning className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                        {new Date(ll.fecha_llamada).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-black text-neutral-600 uppercase italic tracking-widest mt-1">
                        <Monitor size={12} className="text-red-600" /> ST-{ll.dispositivo_id}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-12 py-8 bg-black/40 flex items-center justify-between border-t border-neutral-800">
           <p className="text-[10px] font-black text-neutral-500 italic uppercase">Pagina {currentPage} de {totalPages}</p>
           <div className="flex gap-4">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(prev => prev - 1)} className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white hover:bg-red-600 disabled:opacity-20 transition-all active:scale-90"><ChevronLeft size={20} /></button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => prev + 1)} className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white hover:bg-red-600 disabled:opacity-20 transition-all active:scale-90"><ChevronRight size={20} /></button>
           </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color, bar, progress, icon, glow }: any) {
  return (
    <div className={`bg-neutral-900/50 border border-neutral-800 p-10 rounded-[3.5rem] relative group overflow-hidden shadow-2xl transition-all hover:border-red-600/50 backdrop-blur-md ${glow ? 'hover:shadow-red-900/30' : ''}`}>
      <div className="flex justify-between items-start relative z-10">
        <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] mb-4 italic leading-none">{label}</p>
        <div className={`text-red-600 opacity-20 group-hover:opacity-100 group-hover:scale-125 transition-all duration-700 ${glow ? 'group-hover:animate-pulse' : ''}`}>{icon}</div>
      </div>
      <div className="flex items-baseline gap-4 relative z-10">
        <h2 className={`text-8xl font-black italic tracking-tighter transition-all group-hover:scale-105 duration-500 ${color}`}>{value}</h2>
        {sub && <span className="text-neutral-600 text-[11px] font-black uppercase italic tracking-widest opacity-40">{sub}</span>}
      </div>
      {bar && (
        <div className="w-full bg-neutral-800/50 h-2 mt-10 rounded-full overflow-hidden shadow-inner border border-white/5">
          <div className="bg-red-600 h-full transition-all duration-1000 shadow-[0_0_20px_rgba(220,38,38,0.6)]" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  )
}