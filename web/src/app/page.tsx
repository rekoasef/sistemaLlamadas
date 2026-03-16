'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PhoneIncoming, PhoneOutgoing, Activity, UserPlus, Monitor, RefreshCw,
  Calendar as CalendarIcon, ArrowDownLeft, ArrowUpRight, TrendingUp,
  ChevronLeft, ChevronRight, Zap, Clock, Wifi, AlertCircle, Hourglass, X
} from 'lucide-react'
import ModalVincular from '@/components/ModalVincular'

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
  
  const [filtroDispositivo, setFiltroDispositivo] = useState('TODOS')
  const [usarCalendario, setUsarCalendario] = useState(false)
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'total'>('total')
  const [fechaEspecifica, setFechaEspecifica] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear())

  const fetchLlamadas = useCallback(async () => {
    setLoading(true)
    
    // MODIFICADO: Incluye relación con dispositivo_alias
    let query = supabase
      .from('llamadas')
      .select('*, concesionarios:concesionario_id (nombre), dispositivo:dispositivo_id(alias)')
      .order('fecha_llamada', { ascending: false })

    if (!usarCalendario) {
      const ahora = new Date()
      if (periodo === 'dia') {
        const hoy = new Date(ahora.setHours(0,0,0,0)).toISOString()
        query = query.gte('fecha_llamada', hoy)
      } else if (periodo === 'semana') {
        const haceSieteDias = new Date(ahora.setDate(ahora.getDate() - 7)).toISOString()
        query = query.gte('fecha_llamada', haceSieteDias)
      } else if (periodo === 'mes') {
        const haceUnMes = new Date(ahora.setMonth(ahora.getMonth() - 1)).toISOString()
        query = query.gte('fecha_llamada', haceUnMes)
      }
    } else {
      if (fechaEspecifica) {
        query = query.gte('fecha_llamada', `${fechaEspecifica}T00:00:00`).lte('fecha_llamada', `${fechaEspecifica}T23:59:59`)
      } else {
        const inicio = new Date(anioSeleccionado, mesSeleccionado - 1, 1).toISOString()
        const fin = new Date(anioSeleccionado, mesSeleccionado, 0, 23, 59, 59).toISOString()
        query = query.gte('fecha_llamada', inicio).lte('fecha_llamada', fin)
      }
    }

    const { data } = await query.limit(200)
    setLlamadasRaw(data || [])
    setLoading(false)
  }, [periodo, usarCalendario, fechaEspecifica, mesSeleccionado, anioSeleccionado])

  useEffect(() => {
    fetchLlamadas()
    const channel = supabase.channel('dashboard-realtime-final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, async (payload) => {
        setEventFlash(true)
        setTimeout(() => setEventFlash(false), 2000)
        const id = payload.new ? (payload.new as any).id : (payload.old as any).id
        // MODIFICADO: Fetch de realtime también trae el alias
        const { data: fullRow } = await supabase.from('llamadas').select('*, concesionarios:concesionario_id (nombre), dispositivo:dispositivo_id(alias)').eq('id', id).single()
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
      return filtroDispositivo === 'TODOS' || ll.dispositivo_id === filtroDispositivo
    })
  }, [llamadasRaw, filtroDispositivo])

  const stats = useMemo(() => {
    let entrantes = 0, salientes = 0, auditadasTotal = 0, atendidasAuditadas = 0, perdidasComerciales = 0
    filtradas.forEach(l => {
      if (l.tipo_llamada === 'ENTRANTE') entrantes++
      else salientes++
      const hora = new Date(l.fecha_llamada).getHours()
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
    const segundos = ll.duracion_segundos || 0;
    if (segundos === 0) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  return (
    <div className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4 pt-10 ${eventFlash ? 'ring-1 ring-red-600/20' : ''}`}>
      {showModal && <ModalVincular numero={selectedNum} onClose={() => setShowModal(false)} onSuccess={fetchLlamadas} />}

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
          
          <div className="flex flex-col gap-3">
             <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden self-end">
                <button onClick={() => setUsarCalendario(false)} className={`px-4 py-2 text-[9px] font-black uppercase ${!usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>Rápido</button>
                <button onClick={() => setUsarCalendario(true)} className={`px-4 py-2 text-[9px] font-black uppercase ${usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>Calendario</button>
             </div>

             <div className="flex items-center gap-4 bg-neutral-900/50 p-2 rounded-[2rem] border border-neutral-800 backdrop-blur-md">
                {!usarCalendario ? (
                  <div className="flex items-center gap-1">
                    {['dia', 'semana', 'mes', 'total'].map((t) => (
                      <button key={t} onClick={() => setPeriodo(t as any)} className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${periodo === t ? 'bg-red-600 text-white' : 'text-neutral-500 hover:text-white'}`}>
                        {t === 'dia' ? 'Hoy' : t === 'semana' ? '7 Días' : t === 'mes' ? '30 Días' : 'Todo'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center px-2">
                    <input type="date" value={fechaEspecifica} onChange={(e) => setFechaEspecifica(e.target.value)} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none focus:border-red-600"/>
                    <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(Number(e.target.value))} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none cursor-pointer">
                      {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                    </select>
                    <select value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(Number(e.target.value))} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none cursor-pointer">
                      {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}
                
                <div className="h-8 w-px bg-neutral-800 mx-1" />
                
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
      </div>

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
        <StatCard label="Llamadas Perdidas" value={stats.perdidasComerciales} color="text-red-600" icon={<AlertCircle size={40} className="opacity-20 group-hover:animate-bounce" />} sub="Perdidas (07-19hs)" glow />
      </div>

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
                  <td className="px-12 py-8 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span suppressHydrationWarning className="text-white font-black italic text-2xl tracking-tighter group-hover:text-red-500 transition-colors leading-none">
                        {new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit' })} HS
                      </span>
                      <span suppressHydrationWarning className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">
                        {new Date(ll.fecha_llamada).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2 text-[10px] font-black text-neutral-600 uppercase italic tracking-widest mt-1">
                        <Monitor size={12} className="text-red-600" /> 
                        {/* MODIFICADO: Muestra Alias si existe, sino ID */}
                        {ll.dispositivo?.alias || `ST-${ll.dispositivo_id}`}
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