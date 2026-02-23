'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  Clock, 
  TrendingUp, 
  AlertCircle,
  Phone
} from 'lucide-react'

// Definimos la interfaz para TypeScript
interface Llamada {
  id: string
  numero_telefono: string
  tipo_llamada: string
  estado: string
  duracion_segundos: number
  fecha_llamada: string
  dispositivo_id: string
}

export default function DashboardPage() {
  const [llamadas, setLlamadas] = useState<Llamada[]>([])
  const [loading, setLoading] = useState(true)

  // Cálculos de métricas
  const totalHoy = llamadas.length
  const atendidas = llamadas.filter(ll => ll.estado === 'ATENDIDA').length
  const perdidas = llamadas.filter(ll => ll.estado === 'PERDIDA').length
  const tasaEfectividad = totalHoy > 0 ? Math.round((atendidas / totalHoy) * 100) : 0

  useEffect(() => {
    // 1. Función para cargar datos iniciales
    const fetchLlamadas = async () => {
      const { data, error } = await supabase
        .from('llamadas')
        .select('*')
        .order('fecha_llamada', { ascending: false })
        .limit(20)
      
      if (data) setLlamadas(data)
      setLoading(false)
    }

    fetchLlamadas()

    // 2. Suscripción en Tiempo Real (Escucha nuevos INSERTs)
    const channel = supabase
      .channel('cambios-llamadas')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'llamadas' }, 
        (payload) => {
          console.log('Nueva llamada recibida:', payload.new)
          setLlamadas((prev) => [payload.new as Llamada, ...prev].slice(0, 20))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* HEADER DE SECCIÓN */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tighter text-white italic">PANEL GENERAL</h1>
          <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest">Monitoreo de red Crucianelli en vivo</p>
        </div>
        <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-4 py-2 rounded-full text-[10px] font-bold text-neutral-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          SISTEMA EN LÍNEA
        </div>
      </div>

      {/* GRID DE MÉTRICAS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tarjeta: Total Llamadas */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] text-white/5 group-hover:text-white/10 transition-colors">
            <Phone size={80} />
          </div>
          <p className="text-neutral-500 text-xs font-bold uppercase">Llamadas (Últimas 20)</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className="text-4xl font-black text-white">{totalHoy}</h3>
            <span className="text-neutral-600 text-xs font-bold uppercase tracking-tighter">Registradas</span>
          </div>
        </div>

        {/* Tarjeta: Tasa de Atención */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] text-white/5 group-hover:text-white/10 transition-colors">
            <TrendingUp size={80} />
          </div>
          <p className="text-neutral-500 text-xs font-bold uppercase">Tasa de Atención</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className={`text-4xl font-black ${tasaEfectividad > 75 ? 'text-green-500' : 'text-yellow-500'}`}>
              {tasaEfectividad}%
            </h3>
            <span className="text-neutral-600 text-xs font-bold uppercase tracking-tighter">Eficiencia</span>
          </div>
          <div className="w-full bg-neutral-800 h-1.5 mt-4 rounded-full overflow-hidden">
             <div 
               className="bg-red-600 h-full transition-all duration-1000" 
               style={{ width: `${tasaEfectividad}%` }}
             ></div>
          </div>
        </div>

        {/* Tarjeta: Llamadas Perdidas */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] text-white/5 group-hover:text-white/10 transition-colors">
            <AlertCircle size={80} />
          </div>
          <p className="text-neutral-500 text-xs font-bold uppercase">Llamadas Perdidas</p>
          <div className="flex items-baseline gap-2 mt-2">
            <h3 className={`text-4xl font-black ${perdidas > 0 ? 'text-red-600' : 'text-neutral-400'}`}>
              {perdidas}
            </h3>
            <span className="text-neutral-600 text-xs font-bold uppercase tracking-tighter">Sin Atender</span>
          </div>
        </div>
      </div>

      {/* TABLA DE LLAMADAS */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-800/20">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Monitor de Actividad</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-800/50 text-[10px] uppercase font-bold text-neutral-500 tracking-widest">
              <tr>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Número de Teléfono</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Duración</th>
                <th className="px-6 py-4">Origen</th>
                <th className="px-6 py-4 text-right">Fecha y Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {llamadas.map((llamada) => (
                <tr key={llamada.id} className="hover:bg-red-600/5 transition-colors group">
                  <td className="px-6 py-4">
                    {llamada.tipo_llamada === 'ENTRANTE' ? 
                      <div className="flex items-center gap-2 text-blue-400">
                        <PhoneIncoming size={16} />
                        <span className="text-[10px] font-bold uppercase">Entrante</span>
                      </div> : 
                      <div className="flex items-center gap-2 text-purple-400">
                        <PhoneOutgoing size={16} />
                        <span className="text-[10px] font-bold uppercase">Saliente</span>
                      </div>
                    }
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-white group-hover:text-red-500 transition-colors">
                      {llamada.numero_telefono}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                      llamada.estado === 'ATENDIDA' 
                        ? 'bg-green-500/10 text-green-500 border border-green-500/20' 
                        : 'bg-red-500/10 text-red-500 border border-red-500/20'
                    }`}>
                      {llamada.estado === 'PERDIDA' && <PhoneMissed size={10} />}
                      {llamada.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-neutral-400">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-neutral-600" />
                      <span className="font-medium">{llamada.duracion_segundos}s</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-neutral-800 text-neutral-300 px-2 py-1 rounded text-[10px] font-bold border border-neutral-700 uppercase">
                      Puesto {llamada.dispositivo_id}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-500 font-medium text-xs">
                    {new Date(llamada.fecha_llamada).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {llamadas.length === 0 && (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="animate-pulse bg-neutral-800 p-4 rounded-full">
                <Phone size={32} className="text-neutral-600" />
              </div>
              <p className="text-neutral-500 font-bold uppercase text-xs tracking-widest italic">Aguardando tráfico de red...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}