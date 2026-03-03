'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ChevronLeft, PhoneIncoming, PhoneOutgoing, 
  Clock, Activity, Zap, AlertCircle, Monitor 
} from 'lucide-react'

export default function ConcesionarioDetalle() {
  const { id } = useParams()
  const router = useRouter()
  const [concesionario, setConcesionario] = useState<any>(null)
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // 1. Obtener datos del concesionario
    const { data: info } = await supabase
      .from('concesionarios')
      .select('*')
      .eq('id', id)
      .single()
    
    // 2. Obtener historial de llamadas de este concesionario
    const { data: calls } = await supabase
      .from('llamadas')
      .select('*')
      .eq('concesionario_id', id)
      .order('fecha_llamada', { ascending: false })

    setConcesionario(info)
    setLlamadas(calls || [])
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  // KPIs específicos del concesionario [cite: 82, 83, 84]
  const stats = useMemo(() => {
    const atendidas = llamadas.filter(l => l.estado === 'ATENDIDA').length
    const eficiencia = llamadas.length > 0 ? Math.round((atendidas / llamadas.length) * 100) : 0
    const duracionPromedio = llamadas.length > 0 
      ? Math.round(llamadas.reduce((acc, curr) => acc + (curr.duracion_segundos || 0), 0) / llamadas.length)
      : 0

    return { total: llamadas.length, eficiencia, duracionPromedio }
  }, [llamadas])

  if (loading) return <div className="p-20 text-white animate-pulse">CARGANDO TELEMETRÍA...</div>

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-20 px-4 pt-10 animate-in fade-in duration-500">
      
      {/* BOTÓN VOLVER Y HEADER */}
      <div className="flex flex-col gap-6">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-500 hover:text-red-600 transition-colors uppercase text-[10px] font-black tracking-widest"
        >
          <ChevronLeft size={16} /> Volver al Panel
        </button>
        
        <div className="border-b border-neutral-800 pb-10">
          <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mb-2 italic">Expediente de Concesionario</p>
          <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
            {concesionario?.nombre}
          </h1>
          <p className="text-neutral-500 font-mono mt-4 text-lg italic">{concesionario?.localidad || 'Sín Localidad Definida'}</p>
        </div>
      </div>

      {/* DASHBOARD MINI (KPIs) [cite: 135] */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2.5rem] backdrop-blur-md">
          <p className="text-neutral-500 text-[10px] font-black uppercase mb-4 tracking-widest">Total Interacciones</p>
          <h2 className="text-6xl font-black italic text-white">{stats.total}</h2>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2.5rem] backdrop-blur-md">
          <p className="text-neutral-500 text-[10px] font-black uppercase mb-4 tracking-widest">Eficiencia de Atención</p>
          <h2 className="text-6xl font-black italic text-green-500">{stats.eficiencia}%</h2>
          <div className="w-full bg-neutral-800 h-1.5 mt-4 rounded-full overflow-hidden">
            <div className="bg-green-500 h-full" style={{ width: `${stats.eficiencia}%` }} />
          </div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2.5rem] backdrop-blur-md">
          <p className="text-neutral-500 text-[10px] font-black uppercase mb-4 tracking-widest">Tiempos de Conversación (avg)</p>
          <h2 className="text-6xl font-black italic text-blue-500">{Math.floor(stats.duracionPromedio / 60)}:{ (stats.duracionPromedio % 60).toString().padStart(2, '0') }</h2>
        </div>
      </div>

      {/* HISTORIAL ESPECÍFICO  */}
      <div className="bg-neutral-900/40 border border-neutral-800 rounded-[3rem] overflow-hidden backdrop-blur-md">
        <div className="px-10 py-8 border-b border-neutral-800 flex items-center gap-4">
          <Activity size={20} className="text-red-600" />
          <h3 className="text-sm font-black uppercase tracking-widest text-white italic">Historial Crítico de Llamadas</h3>
        </div>
        <table className="w-full text-left">
          <tbody className="divide-y divide-neutral-800/30">
            {llamadas.map((ll) => (
              <tr key={ll.id} className="hover:bg-white/[0.02] transition-colors group">
                <td className="px-10 py-6">
                  <div className="flex items-center gap-4">
                    <div className={ll.tipo_llamada === 'ENTRANTE' ? 'text-blue-500' : 'text-purple-500'}>
                      {ll.tipo_llamada === 'ENTRANTE' ? <PhoneIncoming size={18} /> : <PhoneOutgoing size={18} />}
                    </div>
                    <div>
                      <p className="text-white font-black italic uppercase text-sm leading-none">{ll.estado}</p>
                      <p className="text-[10px] text-neutral-600 font-bold mt-1">{new Date(ll.fecha_llamada).toLocaleString('es-AR')}</p>
                    </div>
                  </div>
                </td>
                <td className="px-10 py-6 text-right">
                  <div className="flex flex-col items-end">
                    <span className="text-white font-mono font-bold">{ll.duracion_segundos}s</span>
                    <span className="text-[9px] text-neutral-600 uppercase font-black italic">Terminal ST-{ll.dispositivo_id}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {llamadas.length === 0 && (
          <div className="p-20 text-center text-neutral-600 uppercase font-black text-xs tracking-widest">
            No hay registros de llamadas para este concesionario
          </div>
        )}
      </div>
    </div>
  )
}