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
  ChevronRight,
  AlertTriangle,
  Clock,
  PhoneCall,
  Calendar
} from 'lucide-react'

// DEFINICIÓN DE INTERFACES PARA TYPESCRIPT
interface PuestoStats {
  id: string;
  total: number;
  atendidas: number;
}

interface FugaStats {
  nombre: string;
  cantidad: number;
}

export default function AnaliticaPage() {
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [emailReporte, setEmailReporte] = useState('')

  useEffect(() => {
    const fetchFullData = async () => {
      // Traemos las llamadas con el nombre del concesionario para el BI
      const { data } = await supabase
        .from('llamadas')
        .select(`
          *,
          concesionarios:concesionario_id (nombre)
        `)
      setLlamadas(data || [])
      setLoading(false)
    }
    fetchFullData()
  }, [])

  // 1. 📊 Rendimiento por Puesto (Terminal) - CORREGIDO PARA BUILD
  const statsPorPuesto = useMemo((): PuestoStats[] => {
    const map: Record<string, PuestoStats> = {}
    llamadas.forEach(ll => {
      const id = ll.dispositivo_id || 'S/D'
      if (!map[id]) map[id] = { id, total: 0, atendidas: 0 }
      map[id].total++
      if (ll.estado?.toUpperCase() === 'ATENDIDA') map[id].atendidas++
    })
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [llamadas])

  // 2. 🕒 Mapa de Calor Horario (Sombreado por intensidad)
  const statsHorarias = useMemo((): number[] => {
    const horas = new Array(24).fill(0)
    llamadas.forEach(ll => {
      if (ll.fecha_llamada) {
        const hora = new Date(ll.fecha_llamada).getHours()
        horas[hora]++
      }
    })
    return horas
  }, [llamadas])

  // 3. ⚠️ Top Concesionarios con Llamadas Perdidas
  const fugasPorConcesionario = useMemo((): FugaStats[] => {
    const map: Record<string, number> = {}
    llamadas.filter(l => ['PERDIDA', 'RECHAZADA'].includes(l.estado?.toUpperCase() || ''))
    .forEach(ll => {
      const nombre = ll.concesionarios?.nombre || 'SIN VINCULAR'
      if (!map[nombre]) map[nombre] = 0
      map[nombre]++
    })
    return Object.entries(map)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6)
  }, [llamadas])

  // 4. 📅 Día de la Semana con más tráfico
  const diaMasActivo = useMemo((): string => {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]
    const conteo = new Array(7).fill(0)
    llamadas.forEach(ll => {
      if (ll.fecha_llamada) {
        const dia = new Date(ll.fecha_llamada).getDay()
        conteo[dia]++
      }
    })
    const maxIndex = conteo.indexOf(Math.max(...conteo))
    return llamadas.length > 0 ? dias[maxIndex] : 'N/A'
  }, [llamadas])

  const activarReporte = () => {
    if(!emailReporte) return alert("Ingresá un email válido")
    alert(`Configuración Exitosa: Cruci Track enviará reportes a ${emailReporte} todos los viernes.`)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-black text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-600 border-b-4 border-transparent"></div>
        <p className="font-black italic uppercase text-xs tracking-widest animate-pulse">Procesando Big Data...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000 px-4">
      
      {/* HEADER BI */}
      <div className="border-b border-neutral-800 pb-8 mt-10">
        <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
          BUSINESS <span className="text-red-600">INTELLIGENCE</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4 italic">
          Auditoría de Red y Eficiencia Comercial Crucianelli
        </p>
      </div>

      {/* KPI GRID SUPERIOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <MiniCard icon={<Zap />} label="Terminal Líder" value={statsPorPuesto[0]?.id || 'N/A'} color="text-yellow-500" />
        <MiniCard icon={<Users />} label="Cartera Única" value={`${new Set(llamadas.map(l => l.numero_telefono)).size}`} sub="CLIENTES" />
        <MiniCard icon={<Calendar />} label="Día Crítico" value={diaMasActivo} color="text-blue-500" />
        <MiniCard icon={<AlertTriangle />} label="Ventas en Riesgo" value={llamadas.filter(l => l.estado !== 'ATENDIDA').length} color="text-red-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* GRÁFICO 1: RENDIMIENTO POR TERMINAL */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-3">
              <BarChart3 className="text-red-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Rendimiento por Terminal</h3>
            </div>
          </div>
          <div className="space-y-8">
            {statsPorPuesto.map((p) => {
              const porcentaje = Math.round((p.atendidas / p.total) * 100)
              return (
                <div key={p.id} className="space-y-3">
                  <div className="flex justify-between items-end">
                    <span className="text-white font-black italic uppercase text-xl">PUESTO {p.id}</span>
                    <span className="text-neutral-500 text-[10px] font-black italic">{p.atendidas}/{p.total} ATENDIDAS</span>
                  </div>
                  <div className="w-full bg-neutral-800 h-3 rounded-full overflow-hidden flex shadow-inner border border-neutral-700">
                    <div 
                      className={`h-full transition-all duration-1000 ${porcentaje > 70 ? 'bg-green-500' : porcentaje > 40 ? 'bg-yellow-500' : 'bg-red-600'}`} 
                      style={{ width: `${porcentaje}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* GRÁFICO 2: MAPA DE CALOR */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl flex flex-col backdrop-blur-md">
          <div className="flex items-center gap-3 mb-10">
            <Clock className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Puntos Calientes (Tráfico 24hs)</h3>
          </div>
          <div className="flex-1 flex items-end justify-between gap-1 h-64 border-b border-neutral-800 pb-2">
            {statsHorarias.map((count, i) => {
              const max = Math.max(...statsHorarias)
              const height = max > 0 ? (count / max) * 100 : 0
              return (
                <div 
                  key={i} 
                  className={`transition-all rounded-t-sm relative group flex-1 ${count === max && count > 0 ? 'bg-red-600' : 'bg-neutral-700 hover:bg-red-400'}`}
                  style={{ height: `${height}%` }}
                >
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 whitespace-nowrap">
                    {i}:00hs | {count} Lls
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-4 text-[8px] font-black text-neutral-600 uppercase italic">
            <span>00:00 AM</span>
            <span>12:00 PM</span>
            <span>11:59 PM</span>
          </div>
        </div>
      </div>

      {/* SECCIÓN RANKING FUGAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem]">
          <div className="flex items-center gap-3 mb-10">
            <AlertTriangle className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Ranking de Incidencias (Perdidas)</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             {fugasPorConcesionario.map((f, idx) => (
               <div key={idx} className="flex items-center justify-between p-5 bg-black/40 border border-neutral-800 rounded-2xl group hover:border-red-600 transition-colors">
                  <div className="flex flex-col">
                    <span className="text-white font-black italic uppercase text-lg leading-none">{f.nombre}</span>
                    <span className="text-[9px] text-neutral-600 font-bold mt-1 uppercase italic">Concesionario</span>
                  </div>
                  <div className="text-right">
                    <span className="text-red-600 font-black text-2xl italic leading-none">{f.cantidad}</span>
                    <p className="text-[8px] text-neutral-600 font-black uppercase">Fugas</p>
                  </div>
               </div>
             ))}
          </div>
        </div>

        <div className="bg-red-600/5 border border-red-600/20 p-10 rounded-[3rem] flex flex-col justify-center items-center text-center">
             <PhoneCall size={48} className="text-red-600 mb-6 animate-pulse" />
             <h4 className="text-white font-black italic uppercase text-3xl tracking-tighter leading-none mb-2">
                {llamadas.filter(l => l.tipo_llamada === 'ENTRANTE').length} / {llamadas.filter(l => l.tipo_llamada === 'SALIENTE').length}
             </h4>
             <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] italic">
                Entrantes vs Salientes
             </p>
        </div>
      </div>

      {/* REPORTES EMAIL */}
      <div className="bg-red-600 p-12 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-red-600/30">
        <div className="text-center lg:text-left">
          <div className="flex items-center justify-center lg:justify-start gap-3 mb-3 text-white">
            <Mail size={32} />
            <h3 className="text-4xl font-black italic uppercase leading-none">Reportes Automáticos</h3>
          </div>
          <p className="text-white/80 text-[11px] font-bold uppercase tracking-[0.2em] italic">
            Recibí la auditoría semanal Crucianelli en tu correo
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
            Activar BI <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  )
}

function MiniCard({ icon, label, value, sub = "", color = "text-red-600" }: any) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2rem] flex items-center gap-5 group hover:border-red-600/50 transition-all shadow-lg backdrop-blur-sm">
      <div className={`bg-neutral-800 p-4 rounded-2xl ${color} group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner`}>
        {icon}
      </div>
      <div>
        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-2 italic">{label}</p>
        <p className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{value}</p>
        {sub && <p className="text-[8px] text-neutral-600 font-bold uppercase mt-1 tracking-widest">{sub}</p>}
      </div>
    </div>
  )
}