'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Monitor, Smartphone, Activity, Clock, ArrowRight, X, PhoneIncoming, PhoneOutgoing } from 'lucide-react'

interface StatsDispositivo {
  id: string
  totalLlamadas: number
  ultimaConexion: string
  promedioDuracion: number
}

export default function DispositivosPage() {
  const [llamadasRaw, setLlamadasRaw] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDevId, setSelectedDevId] = useState<string | null>(null)

  const fetchDatos = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('llamadas')
      .select('*')
      .order('fecha_llamada', { ascending: false })

    if (!error && data) {
      setLlamadasRaw(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDatos()
  }, [])

  // Agrupación de estadísticas por dispositivo
  const dispositivos = useMemo(() => {
    const agrupados = llamadasRaw.reduce((acc: any, curr) => {
      const id = curr.dispositivo_id || 'DESCONOCIDO'
      if (!acc[id]) {
        acc[id] = { id, total: 0, ultima: curr.fecha_llamada, sumaDuracion: 0 }
      }
      acc[id].total += 1
      acc[id].sumaDuracion += (curr.duracion_segundos || 0)
      if (new Date(curr.fecha_llamada) > new Date(acc[id].ultima)) {
        acc[id].ultima = curr.fecha_llamada
      }
      return acc
    }, {})

    return Object.values(agrupados) as any[]
  }, [llamadasRaw])

  // Filtrado para el historial detallado
  const historialFiltrado = llamadasRaw.filter(ll => ll.dispositivo_id === selectedDevId)

  return (
    <div className="relative min-h-screen space-y-10 animate-in fade-in duration-700">
      {/* HEADER */}
      <div>
        <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">
          TERMINALES <span className="text-red-600">ACTIVAS</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 italic">
          Gestión de hardware y puestos de red
        </p>
      </div>

      {/* GRID DE DISPOSITIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {dispositivos.map((dev) => (
          <div key={dev.id} className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[2.5rem] relative group hover:border-red-600 transition-all shadow-xl">
            <div className="flex justify-between items-start mb-8">
              <div className="p-4 bg-neutral-800 rounded-2xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all">
                <Smartphone size={24} />
              </div>
            </div>

            <h3 className="text-3xl font-black text-white italic uppercase mb-1 tracking-tight">{dev.id}</h3>
            <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.2em] mb-8">ID de Puesto Registrado</p>

            <div className="space-y-4 border-t border-neutral-800 pt-6">
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 text-[10px] font-black uppercase italic">Actividad Total</span>
                <span className="text-white font-black italic">{dev.total} LLAMADAS</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-600 text-[10px] font-black uppercase italic">Estado Actual</span>
                <span className="text-green-500 font-black text-[9px] uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded border border-green-500/20">Online</span>
              </div>
            </div>

            <button 
              onClick={() => setSelectedDevId(dev.id)}
              className="w-full mt-8 bg-neutral-800 hover:bg-white hover:text-black text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all uppercase text-[10px] italic tracking-widest"
            >
              Ver Historial Completo <ArrowRight size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* OVERLAY / HISTORIAL DETALLADO (DRAWER) */}
      {selectedDevId && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setSelectedDevId(null)} />
          
          <div className="relative w-full max-w-2xl bg-black border-l border-neutral-800 shadow-2xl animate-in slide-in-from-right duration-500 flex flex-col">
            <div className="p-10 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
              <div>
                <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter">REGISTRO <span className="text-red-600">{selectedDevId}</span></h2>
                <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-widest mt-1 italic">Historial completo de llamadas del dispositivo</p>
              </div>
              <button onClick={() => setSelectedDevId(null)} className="p-3 bg-neutral-800 text-white rounded-full hover:bg-red-600 transition-all">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-10 space-y-4">
              {historialFiltrado.map((ll) => (
                <div key={ll.id} className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-3xl flex items-center justify-between group hover:border-neutral-600 transition-all">
                  <div className="flex items-center gap-5">
                    <div className={`${ll.tipo_llamada === 'ENTRANTE' ? 'text-blue-500' : 'text-purple-500'} bg-neutral-800 p-3 rounded-xl`}>
                      {ll.tipo_llamada === 'ENTRANTE' ? <PhoneIncoming size={20}/> : <PhoneOutgoing size={20}/>}
                    </div>
                    <div>
                      <p className="text-white font-black italic uppercase text-lg leading-none">{ll.numero_telefono}</p>
                      <p className="text-neutral-600 text-[10px] font-bold uppercase mt-1 italic">
                        {new Date(ll.fecha_llamada).toLocaleString('es-AR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                      ll.estado?.toUpperCase() === 'ATENDIDA' ? 'text-green-500 border-green-500/20 bg-green-500/5' : 'text-red-600 border-red-600/20 bg-red-600/5'
                    }`}>
                      {ll.estado}
                    </span>
                    <p className="text-neutral-500 font-mono text-xs mt-2">{ll.duracion_segundos}s</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}