'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, PhoneIncoming, PhoneOutgoing, 
  Activity, Zap, Phone, Calendar,
  BarChart3, Clock, Monitor, Hourglass, X
} from 'lucide-react'

export default function ConcesionarioDetalle() {
  const { id } = useParams()
  const router = useRouter()
  
  // ESTADOS DE DATOS
  const [concesionario, setConcesionario] = useState<any>(null)
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // ESTADO DE FILTRO TEMPORAL [cite: 97]
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes' | 'total'>('total')
  
  // --- NUEVOS ESTADOS DE FILTRADO ---
  const [fechaEspecifica, setFechaEspecifica] = useState('')
  const [mesSeleccionado, setMesSeleccionado] = useState(new Date().getMonth() + 1)
  const [anioSeleccionado, setAnioSeleccionado] = useState(new Date().getFullYear())
  const [usarCalendario, setUsarCalendario] = useState(false)

  // --- NUEVO ESTADO PARA MODAL ---
  const [numeroDetalle, setNumeroDetalle] = useState<{numero: string, llamadas: any[]} | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // 1. Obtener información del concesionario [cite: 122, 128]
    const { data: info } = await supabase
      .from('concesionarios')
      .select('*, concesionario_telefonos(*)')
      .eq('id', Array.isArray(id) ? id[0] : id)
      .single()

    // 2. Construir query de llamadas [cite: 74, 97]
    let query = supabase
      .from('llamadas')
      .select('*')
      .eq('concesionario_id', Array.isArray(id) ? id[0] : id)

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

    const { data: calls } = await query.order('fecha_llamada', { ascending: false })

    setConcesionario(info)
    setLlamadas(calls || [])
    setLoading(false)
  }, [id, periodo, usarCalendario, fechaEspecifica, mesSeleccionado, anioSeleccionado])

  useEffect(() => { fetchData() }, [fetchData])

  // LÓGICA DE AGRUPACIÓN POR NÚMERO [cite: 76, 124]
  const statsPorNumero = useMemo(() => {
    const mapa = new Map()
    concesionario?.concesionario_telefonos?.forEach((tel: any) => {
      mapa.set(tel.numero_telefono, { total: 0, atendidas: 0, perdidas: 0, llamadas: [] })
    })

    llamadas.forEach(l => {
      const current = mapa.get(l.numero_telefono) || { total: 0, atendidas: 0, perdidas: 0, llamadas: [] }
      current.total++
      current.llamadas.push(l)
      if (l.estado === 'ATENDIDA') current.atendidas++
      else current.perdidas++
      mapa.set(l.numero_telefono, current)
    })

    return Array.from(mapa.entries()).sort((a, b) => b[1].total - a[1].total)
  }, [llamadas, concesionario])

  const globalStats = useMemo(() => {
    const atendidas = llamadas.filter(l => l.estado === 'ATENDIDA').length
    const eficiencia = llamadas.length > 0 ? Math.round((atendidas / llamadas.length) * 100) : 0
    return { total: llamadas.length, eficiencia }
  }, [llamadas])

  const formatDuracion = (segundos: number) => {
    const mins = Math.floor(segundos / 60)
    const secs = segundos % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-black">
      <div className="text-red-600 animate-pulse font-black italic uppercase tracking-[0.5em]">Sincronizando Telemetría...</div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 pt-10 animate-in fade-in duration-700">
      
      {/* --- NUEVO MODAL EMERGENTE POR NÚMERO --- */}
      {numeroDetalle && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4">
          <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl">
            <div className="p-8 border-b border-neutral-800 flex justify-between items-center">
              <div>
                <p className="text-red-600 font-black uppercase text-[10px] tracking-widest">Registros de Línea</p>
                <h2 className="text-4xl font-black text-white italic">{numeroDetalle.numero}</h2>
              </div>
              <button onClick={() => setNumeroDetalle(null)} className="p-4 bg-neutral-800 rounded-full text-white hover:bg-red-600 transition-all"><X size={24}/></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-8 space-y-4">
              {numeroDetalle.llamadas.map((l: any) => (
                <div key={l.id} className="flex items-center justify-between p-6 bg-neutral-800/30 border border-neutral-800 rounded-2xl">
                  <div className="flex items-center gap-4">
                    <div className={l.estado === 'ATENDIDA' ? 'text-green-500' : 'text-red-600'}><Activity size={20}/></div>
                    <div className="flex flex-col">
                      <span className="text-white font-bold uppercase text-xs">{new Date(l.fecha_llamada).toLocaleString('es-AR')}</span>
                      <span className="text-neutral-500 text-[10px] font-black uppercase tracking-widest">{l.tipo_llamada} - {l.estado}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-mono font-bold text-xl">{formatDuracion(l.duracion_segundos)}</p>
                    <p className="text-[9px] text-neutral-600 uppercase font-black">Duración</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* HEADER DINÁMICO */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-neutral-800 pb-12">
        <div className="space-y-4">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-neutral-600 hover:text-red-600 transition-all uppercase text-[10px] font-black tracking-widest group">
            <ChevronLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Volver a Agenda Red
          </button>
          <div className="flex items-center gap-4">
            <div className="h-16 w-2 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.5)]" />
            <div>
              <h1 className="text-8xl font-black text-white italic uppercase tracking-tighter leading-none">{concesionario?.nombre}</h1>
              <p className="text-neutral-500 font-mono text-xl italic uppercase mt-2 tracking-widest">{concesionario?.localidad || 'Ubicación Industrial'}</p>
            </div>
          </div>
        </div>

        {/* --- SELECTORES DE PERIODO ACTUALIZADOS [cite: 97] --- */}
        <div className="flex flex-col gap-3">
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden self-end">
             <button onClick={() => setUsarCalendario(false)} className={`px-4 py-2 text-[9px] font-black uppercase ${!usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>Rápido</button>
             <button onClick={() => setUsarCalendario(true)} className={`px-4 py-2 text-[9px] font-black uppercase ${usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}>Calendario</button>
          </div>

          {!usarCalendario ? (
            <div className="flex items-center gap-2 bg-neutral-900/50 p-2 rounded-[2rem] border border-neutral-800 backdrop-blur-md">
              <div className="px-4 text-red-600"><Calendar size={18} /></div>
              {['dia', 'semana', 'mes', 'total'].map((t) => (
                <button key={t} onClick={() => setPeriodo(t as any)} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${periodo === t ? 'bg-red-600 text-white shadow-lg' : 'text-neutral-500 hover:text-white'}`}>
                  {t === 'dia' ? 'Hoy' : t === 'semana' ? '7 Días' : t === 'mes' ? '30 Días' : 'Histórico'}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-3 items-center bg-neutral-900/50 p-3 rounded-2xl border border-neutral-800 backdrop-blur-md">
              <input type="date" value={fechaEspecifica} onChange={(e) => setFechaEspecifica(e.target.value)} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[10px] font-black uppercase outline-none focus:border-red-600"/>
              <select value={mesSeleccionado} onChange={(e) => setMesSeleccionado(Number(e.target.value))} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[10px] font-black uppercase outline-none cursor-pointer">
                {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => <option key={m} value={i+1}>{m}</option>)}
              </select>
              <select value={anioSeleccionado} onChange={(e) => setAnioSeleccionado(Number(e.target.value))} className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[10px] font-black uppercase outline-none cursor-pointer">
                {[2024, 2025, 2026].map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* KPIs PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3.5rem] backdrop-blur-md relative overflow-hidden group">
          <BarChart3 className="absolute -right-4 -top-4 text-white/5 size-32 group-hover:text-red-600/10 transition-colors" />
          <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest mb-6">Volumen de Tráfico</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-8xl font-black italic text-white tracking-tighter">{globalStats.total}</h2>
            <span className="text-neutral-700 text-sm font-black uppercase italic tracking-widest leading-none">Llamadas</span>
          </div>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3.5rem] backdrop-blur-md group">
          <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest mb-6">Eficiencia de Respuesta [cite: 82]</p>
          <div className="flex items-baseline gap-4">
            <h2 className={`text-8xl font-black italic tracking-tighter ${globalStats.eficiencia > 70 ? 'text-green-500' : 'text-red-600'}`}>{globalStats.eficiencia}%</h2>
          </div>
          <div className="w-full bg-neutral-800/50 h-2 mt-8 rounded-full overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${globalStats.eficiencia > 70 ? 'bg-green-500' : 'bg-red-600'}`} style={{ width: `${globalStats.eficiencia}%` }} />
          </div>
        </div>
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3.5rem] backdrop-blur-md group">
          <p className="text-neutral-600 text-[10px] font-black uppercase tracking-widest mb-6">Líneas Activas [cite: 122]</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-8xl font-black italic text-white tracking-tighter">{concesionario?.concesionario_telefonos?.length || 0}</h2>
            <span className="text-neutral-700 text-sm font-black uppercase italic tracking-widest leading-none">Terminales</span>
          </div>
        </div>
      </div>

      {/* DESGLOSE POR NÚMERO (ANÁLISIS GRANULAR) [cite: 76] */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-[3.5rem] overflow-hidden backdrop-blur-md">
        <div className="px-12 py-10 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 rounded-2xl shadow-lg shadow-red-900/40"><Phone size={20} className="text-white" /></div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic leading-none">Análisis de Líneas Vinculadas</h3>
              <p className="text-neutral-600 text-[9px] font-black uppercase mt-2 tracking-widest italic">Rendimiento individual por número de teléfono</p>
            </div>
          </div>
          <span className="text-neutral-500 text-[9px] font-black uppercase tracking-widest italic">Haz clic para ver registros</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-12">
          {statsPorNumero.map(([num, stat]: any) => (
            <button 
              key={num} 
              onClick={() => setNumeroDetalle({ numero: num, llamadas: stat.llamadas })}
              className="bg-black/40 border border-neutral-800 p-8 rounded-[2.5rem] group hover:border-red-600/50 transition-all relative overflow-hidden text-left active:scale-[0.98]"
            >
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-20 transition-opacity"><Activity size={40} className="text-red-600" /></div>
              <p className="text-red-600 font-mono text-lg font-bold tracking-widest mb-6 italic">{num}</p>
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-5xl font-black text-white italic tracking-tighter">{stat.total}</p>
                  <p className="text-[9px] text-neutral-600 font-black uppercase italic tracking-widest">Interacciones</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-2 justify-end"><span className="h-1.5 w-1.5 rounded-full bg-green-500" /><p className="text-green-500 font-black italic text-[10px] uppercase">{stat.atendidas} Atendidas</p></div>
                  <div className="flex items-center gap-2 justify-end"><span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" /><p className="text-red-600 font-black italic text-[10px] uppercase">{stat.perdidas} Perdidas</p></div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* LISTADO DE LLAMADAS FILTRADAS [cite: 68, 70] */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-[3.5rem] overflow-hidden backdrop-blur-md">
        <div className="px-12 py-10 border-b border-neutral-800 bg-neutral-900/50 flex items-center gap-4">
          <Activity size={20} className="text-red-600 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic">Activity Stream: {periodo.toUpperCase()}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 border-b border-neutral-800/50">
                <th className="px-12 py-8">Estado / Protocolo [cite: 79]</th>
                <th className="px-12 py-8">Número</th>
                <th className="px-12 py-8 text-center">Duración [cite: 87]</th>
                <th className="px-12 py-8 text-right">Registro [cite: 50]</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/20">
              {llamadas.map((ll) => (
                <tr key={ll.id} className="hover:bg-red-600/[0.03] transition-all group">
                  <td className="px-12 py-8">
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-xl ${ll.tipo_llamada === 'ENTRANTE' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}>
                        {ll.tipo_llamada === 'ENTRANTE' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-white leading-none mb-1">{ll.tipo_llamada}</span>
                        <span className={`text-[8px] font-black uppercase italic ${ll.estado === 'ATENDIDA' ? 'text-green-500' : 'text-red-600'}`}>{ll.estado}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-12 py-8"><span className="text-white font-mono font-bold text-lg tracking-widest italic group-hover:text-red-500 transition-colors">{ll.numero_telefono}</span></td>
                  <td className="px-12 py-8 text-center">
                    <div className="flex flex-col items-center">
                      <div className="flex items-center gap-2 text-white font-mono text-2xl font-bold tracking-tighter leading-none"><Hourglass size={14} className="text-neutral-700" />{formatDuracion(ll.duracion_segundos)}</div>
                      <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest italic mt-1 leading-none">Cronómetro</span>
                    </div>
                  </td>
                  <td className="px-12 py-8 text-right">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-white font-black italic text-2xl tracking-tighter leading-none">{new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} HS</span>
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none">{new Date(ll.fecha_llamada).toLocaleDateString('es-AR')}</span>
                      <div className="flex items-center gap-2 text-[10px] font-black text-neutral-600 uppercase italic tracking-widest mt-1"><Monitor size={12} className="text-red-600" /> Terminal ST-{ll.dispositivo_id}</div>
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