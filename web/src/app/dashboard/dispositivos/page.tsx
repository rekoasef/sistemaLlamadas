'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Smartphone, Activity, CheckCircle2, XCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

interface Llamada {
  dispositivo_id: string
  estado: string
}

interface StatsPuesto {
  id: string
  total: number
  atendidas: number
  rechazadas: number
}

export default function DispositivosPage() {
  const [stats, setStats] = useState<StatsPuesto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      const { data } = await supabase
        .from('llamadas')
        .select('dispositivo_id, estado')
      
      if (data) {
        const grupos = data.reduce((acc: any, curr: Llamada) => {
          const id = curr.dispositivo_id || '1'
          if (!acc[id]) {
            acc[id] = { id, total: 0, atendidas: 0, rechazadas: 0 }
          }
          acc[id].total++
          if (curr.estado === 'ATENDIDA') acc[id].atendidas++
          if (curr.estado === 'RECHAZADA' || curr.estado === 'PERDIDA') acc[id].rechazadas++
          return acc
        }, {})
        
        setStats(Object.values(grupos))
      }
      setLoading(false)
    }

    fetchStats()
  }, [])

  if (loading) return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-600"></div>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto space-y-10">
      {/* HEADER DE SECCIÓN */}
      <div>
        <h1 className="text-4xl font-black tracking-tighter text-white italic uppercase">
          Gestión de Dispositivos
        </h1>
        <p className="text-neutral-500 text-sm font-medium uppercase tracking-[0.2em] mt-2">
          Infraestructura de red y auditoría de terminales
        </p>
      </div>

      {/* GRID DE PUESTOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {stats.map((puesto) => (
          <div 
            key={puesto.id} 
            className="bg-neutral-900/40 border border-neutral-800 rounded-[2rem] overflow-hidden group hover:border-red-600/40 transition-all duration-500 shadow-2xl"
          >
            <div className="p-8">
              {/* STATUS BAR */}
              <div className="flex justify-between items-center mb-8">
                <div className="bg-red-600 p-3 rounded-2xl shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                  <Smartphone className="text-white" size={24} />
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                  <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">En Línea</span>
                </div>
              </div>
              
              {/* INFO PUESTO */}
              <div className="mb-8">
                <h3 className="text-3xl font-black text-white italic tracking-tighter">PUESTO {puesto.id}</h3>
                <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest mt-1">UUID: DEV-CRUCI-{puesto.id}</p>
              </div>
              
              {/* MÉTRICAS DEL DISPOSITIVO */}
              <div className="grid grid-cols-1 gap-3">
                <div className="flex justify-between items-center p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center gap-3 text-neutral-400">
                    <Activity size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total</span>
                  </div>
                  <span className="text-lg font-black text-white">{puesto.total}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center gap-3 text-green-500/80">
                    <CheckCircle2 size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Éxito</span>
                  </div>
                  <span className="text-lg font-black text-white">{puesto.atendidas}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-neutral-800/30 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center gap-3 text-red-500/80">
                    <XCircle size={16} />
                    <span className="text-xs font-bold uppercase tracking-wider">Fallas</span>
                  </div>
                  <span className="text-lg font-black text-white">{puesto.rechazadas}</span>
                </div>
              </div>
            </div>
            
            {/* ACTION FOOTER */}
            <Link 
              href={`/dashboard/dispositivos/${puesto.id}`} // <--- Debe incluir /dashboard/
              className="w-full bg-neutral-800/50 hover:bg-red-600 p-5 flex items-center justify-center gap-3 transition-all duration-300 border-t border-neutral-800 group/btn"
            >
              <span className="text-xs font-black text-neutral-400 group-hover:text-white uppercase tracking-[0.2em]">
                Ver historial detallado
              </span>
              <ArrowRight size={14} className="text-neutral-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}