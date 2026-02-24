'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { 
  ArrowLeft, 
  Smartphone, 
  Clock, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed 
} from 'lucide-react'

interface Llamada {
  id: string
  numero_telefono: string
  tipo_llamada: string
  estado: string
  duracion_segundos: number
  fecha_llamada: string
  dispositivo_id: string
}

export default function DetalleDispositivoPage() {
  const { id } = useParams()
  const router = useRouter()
  const [llamadas, setLlamadas] = useState<Llamada[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDetalle = async () => {
      const { data } = await supabase
        .from('llamadas')
        .select('*')
        .eq('dispositivo_id', id)
        .order('fecha_llamada', { ascending: false })
      
      if (data) setLlamadas(data)
      setLoading(false)
    }

    fetchDetalle()
  }, [id])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* NAVEGACIÓN Y TÍTULO */}
      <div className="flex flex-col gap-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-neutral-500 hover:text-white transition-colors group w-fit"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">Volver a Dispositivos</span>
        </button>
        
        <div className="flex items-center gap-4">
          <div className="bg-red-600/10 p-3 rounded-2xl border border-red-600/20">
            <Smartphone className="text-red-600" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-white italic uppercase">Auditoría: Puesto {id}</h1>
            <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest">Historial completo de este terminal móvil</p>
          </div>
        </div>
      </div>

      {/* TABLA DE ACTIVIDAD ESPECÍFICA */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 border-b border-neutral-800 bg-neutral-800/20">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest">Registros del Puesto</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-800/50 text-[10px] uppercase font-bold text-neutral-500 tracking-widest">
              <tr>
                <th className="px-6 py-4">Evento</th>
                <th className="px-6 py-4">Número de Teléfono</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Duración</th>
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
                      {(llamada.estado === 'RECHAZADA' || llamada.estado === 'PERDIDA') && <PhoneMissed size={10} />}
                      {llamada.estado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-neutral-400">
                    <div className="flex items-center gap-1">
                      <Clock size={12} className="text-neutral-600" />
                      <span className="font-medium">{llamada.duracion_segundos}s</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right text-neutral-500 font-medium text-xs">
                    {new Date(llamada.fecha_llamada).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {llamadas.length === 0 && (
            <div className="p-20 text-center">
              <p className="text-neutral-500 font-bold uppercase text-xs tracking-widest italic">No hay registros para este dispositivo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
