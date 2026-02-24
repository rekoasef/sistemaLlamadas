'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Smartphone, Activity, CheckCircle2, XCircle, ArrowRight, Loader2, RefreshCcw } from 'lucide-react'
import Link from 'next/link'

interface DispositivoConStats {
  id: string
  alias: string
  modelo: string
  imei: string
  total: number
  atendidas: number
  rechazadas: number
}

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<DispositivoConStats[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFullData = useCallback(async () => {
    setLoading(true)
    
    // 1. Traemos todos los dispositivos registrados
    const { data: devs } = await supabase
      .from('dispositivos')
      .select('*')
      .order('alias', { ascending: true })

    // 2. Traemos las llamadas para las métricas
    const { data: calls } = await supabase
      .from('llamadas')
      .select('dispositivo_id, estado')

    if (devs) {
      const listaFinal = devs.map(d => {
        // Filtrar llamadas para este dispositivo específico
        const statsDev = (calls || []).filter(c => c.dispositivo_id === d.id)
        
        return {
          id: d.id,
          alias: d.alias || 'SIN NOMBRE',
          modelo: d.modelo || 'GENERIC',
          imei: d.imei || 'S/N',
          total: statsDev.length,
          atendidas: statsDev.filter(c => c.estado === 'ATENDIDA').length,
          rechazadas: statsDev.filter(c => c.estado === 'RECHAZADA' || c.estado === 'PERDIDA').length
        }
      })
      setDispositivos(listaFinal)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchFullData()
  }, [fetchFullData])

  if (loading) return (
    <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
      <Loader2 className="animate-spin text-red-600" size={40} />
      <p className="text-white font-black italic uppercase text-xs tracking-widest">Sincronizando Hardware...</p>
    </div>
  )

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
      {/* HEADER DE SECCIÓN */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black tracking-tighter text-white italic uppercase leading-none">
            Terminales de Red
          </h1>
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em] mt-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Monitoreo de Infraestructura en Tiempo Real
          </p>
        </div>
        
        <button 
          onClick={fetchFullData}
          className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-neutral-400 hover:text-white transition-all group"
        >
          <RefreshCcw size={20} className="group-active:rotate-180 transition-transform duration-500" />
        </button>
      </div>

      {/* GRID DE DISPOSITIVOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {dispositivos.map((dev) => (
          <div 
            key={dev.id} 
            className="bg-neutral-900/40 border border-neutral-800 rounded-[2.5rem] overflow-hidden group hover:border-red-600/40 transition-all duration-500 shadow-2xl backdrop-blur-sm"
          >
            <div className="p-8">
              <div className="flex justify-between items-center mb-8">
                <div className="bg-red-600 p-4 rounded-2xl shadow-[0_10px_20px_rgba(220,38,38,0.2)] group-hover:scale-110 transition-transform">
                  <Smartphone className="text-white" size={24} />
                </div>
                <div className="text-right">
                    <p className="text-neutral-600 text-[8px] font-black uppercase tracking-widest">Model</p>
                    <p className="text-white font-black italic text-xs uppercase">{dev.modelo}</p>
                </div>
              </div>
              
              <div className="mb-8">
                <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter group-hover:text-red-600 transition-colors">
                  {dev.alias}
                </h3>
                <p className="text-neutral-600 text-[9px] font-mono uppercase tracking-widest mt-1">IMEI: {dev.imei}</p>
              </div>
              
              {/* MÉTRICAS */}
              <div className="grid grid-cols-1 gap-2">
                <div className="flex justify-between items-center p-4 bg-black/40 rounded-2xl border border-neutral-800/50">
                  <div className="flex items-center gap-3 text-neutral-500">
                    <Activity size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Tráfico Total</span>
                  </div>
                  <span className="text-lg font-black text-white italic">{dev.total}</span>
                </div>
                
                <div className="flex justify-between items-center p-4 bg-green-500/5 rounded-2xl border border-green-500/10">
                  <div className="flex items-center gap-3 text-green-500">
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Atendidas</span>
                  </div>
                  <span className="text-lg font-black text-white italic">{dev.atendidas}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-red-500/5 rounded-2xl border border-red-500/10">
                  <div className="flex items-center gap-3 text-red-500">
                    <XCircle size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Perdidas</span>
                  </div>
                  <span className="text-lg font-black text-white italic">{dev.rechazadas}</span>
                </div>
              </div>
            </div>
            
            <Link 
              href={`/dashboard/dispositivos/${dev.id}`}
              className="w-full bg-neutral-800/30 hover:bg-red-600 p-6 flex items-center justify-center gap-3 transition-all duration-300 border-t border-neutral-800/50 group/btn"
            >
              <span className="text-[10px] font-black text-neutral-500 group-hover:text-white uppercase tracking-[0.3em] italic">
                Configuración de Terminal
              </span>
              <ArrowRight size={14} className="text-neutral-500 group-hover:text-white group-hover:translate-x-2 transition-all" />
            </Link>
          </div>
        ))}

        {dispositivos.length === 0 && (
          <div className="col-span-full border-2 border-dashed border-neutral-800 rounded-[3rem] p-20 text-center">
             <p className="text-neutral-600 font-black italic uppercase tracking-widest">No hay terminales vinculadas en la red</p>
          </div>
        )}
      </div>
    </div>
  )
}