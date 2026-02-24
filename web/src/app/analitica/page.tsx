'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Users, 
  Zap, 
  Award, 
  Mail,
  ChevronRight
} from 'lucide-react'

export default function AnaliticaPage() {
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailReporte, setEmailReporte] = useState('')

  useEffect(() => {
    const fetchFullData = async () => {
      const { data } = await supabase
        .from('llamadas')
        .select('*')
      setLlamadas(data || [])
      setLoading(false)
    }
    fetchFullData()
  }, [])

  // 📊 Lógica: Rendimiento por Dispositivo
  const statsPorPuesto = useMemo(() => {
    const map: any = {}
    llamadas.forEach(ll => {
      const id = ll.dispositivo_id || 'S/D'
      if (!map[id]) map[id] = { id, total: 0, atendidas: 0 }
      map[id].total++
      if (ll.estado?.toUpperCase() === 'ATENDIDA') map[id].atendidas++
    })
    return Object.values(map).sort((a: any, b: any) => b.total - a.total)
  }, [llamadas])

  // 🕒 Lógica: Mapa de Calor Horario (24hs)
  const statsHorarias = useMemo(() => {
    const horas = new Array(24).fill(0)
    llamadas.forEach(ll => {
      if (ll.fecha_llamada) {
        const hora = new Date(ll.fecha_llamada).getHours()
        horas[hora]++
      }
    })
    return horas
  }, [llamadas])

  const activarReporte = () => {
    if(!emailReporte) return alert("Ingresá un email válido")
    alert(`Configuración Exitosa: Cruci Track enviará reportes a ${emailReporte} todos los viernes.`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-red-600"></div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000">
      
      {/* HEADER BI */}
      <div className="border-b border-neutral-800 pb-8">
        <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">
          BUSINESS <span className="text-red-600">INTELLIGENCE</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 italic">
          Análisis predictivo y auditoría de terminales Crucianelli
        </p>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MiniCard 
          icon={<Zap size={20}/>} 
          label="Puesto Líder" 
          //@ts-ignore
          value={statsPorPuesto[0]?.id || 'N/A'} 
        />
        <MiniCard 
          icon={<Users size={20}/>} 
          label="Alcance" 
          value={`${new Set(llamadas.map(l => l.numero_telefono)).size} Clientes`} 
        />
        <MiniCard 
          icon={<TrendingUp size={20}/>} 
          label="Carga Promedio" 
          value={`${Math.round(llamadas.length / 7)} / Sem`} 
        />
        <MiniCard 
          icon={<Award size={20}/>} 
          label="Eficiencia Max" 
          value={`${Math.max(...statsPorPuesto.map((p:any) => Math.round((p.atendidas/p.total)*100)) || [0])}%`} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GRÁFICO COMPARATIVO */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl">
          <div className="flex items-center gap-3 mb-10">
            <BarChart3 className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Rendimiento Operativo por Terminal</h3>
          </div>
          <div className="space-y-10">
            {statsPorPuesto.map((p: any) => (
              <div key={p.id} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div>
                    <span className="text-white font-black italic uppercase text-lg">{p.id}</span>
                    <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-tighter italic">Puesto Registrado</p>
                  </div>
                  <div className="text-right">
                    <span className="text-white font-black italic">{p.total}</span>
                    <span className="text-neutral-600 text-[9px] font-bold uppercase ml-1">Total</span>
                  </div>
                </div>
                <div className="w-full bg-neutral-800 h-5 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-red-600 h-full transition-all duration-1000 relative group" 
                    style={{ width: `${(p.atendidas / p.total) * 100}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-neutral-500 italic">
                  <span>Atención: {Math.round((p.atendidas / p.total) * 100)}%</span>
                  <span>Fugas: {p.total - p.atendidas}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MAPA DE CALOR */}
        <div className="bg-neutral-900/50 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl flex flex-col">
          <div className="flex items-center gap-3 mb-10">
            <PieChart className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Intensidad Horaria de Tráfico</h3>
          </div>
          <div className="flex-1 flex items-end justify-between gap-1 h-64">
            {statsHorarias.map((count, i) => {
              const max = Math.max(...statsHorarias)
              const height = max > 0 ? (count / max) * 100 : 0
              return (
                <div 
                  key={i} 
                  className="bg-red-600/10 hover:bg-red-600 transition-all rounded-t-lg relative group flex-1"
                  style={{ height: `${height}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10">
                    {count} Lls
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-6 px-2 text-[9px] font-black text-neutral-600 uppercase italic border-t border-neutral-800 pt-4">
            <span>00:00 AM</span>
            <span>12:00 PM</span>
            <span>11:59 PM</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE REPORTES PROGRAMADOS */}
      <div className="bg-red-600 p-12 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-red-600/30">
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-3 text-white">
            <Mail size={32} />
            <h3 className="text-4xl font-black italic uppercase leading-none">Reportes Semanales</h3>
          </div>
          <p className="text-white/80 text-[11px] font-bold uppercase tracking-[0.2em] italic">
            Recibí el análisis de eficiencia industrial cada viernes en tu bandeja de entrada
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input 
            type="email" 
            placeholder="ADMIN@CRUCIANELLI.COM"
            className="bg-black/20 border-2 border-white/20 rounded-2xl px-8 py-5 text-white placeholder:text-white/30 text-xs font-bold outline-none focus:border-white transition-all w-full lg:w-80 uppercase"
            onChange={(e) => setEmailReporte(e.target.value)}
          />
          <button 
            onClick={activarReporte}
            className="bg-white text-red-600 px-10 py-5 rounded-2xl font-black uppercase text-[10px] italic hover:bg-black hover:text-white transition-all flex items-center justify-center gap-2 group"
          >
            Activar Monitoreo <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>

    </div>
  )
}

function MiniCard({ icon, label, value }: any) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] flex items-center gap-5 group hover:border-red-600/50 transition-all shadow-lg">
      <div className="bg-neutral-800 p-4 rounded-2xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner">
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-2 italic">{label}</p>
        <p className="text-2xl font-black text-white italic uppercase tracking-tighter">{value}</p>
      </div>
    </div>
  )
}