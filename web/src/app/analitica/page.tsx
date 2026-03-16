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
  Calendar,
  ArrowDownLeft,
  ArrowUpRight,
  MousePointer2
} from 'lucide-react'

interface PuestoStats {
  id: string;
  alias: string; // AGREGADO
  total: number;
  atendidas: number;
}

interface FugaStats {
  nombre: string;
  cantidad: number;
}

export default function AnaliticaPage() {
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({}) // AGREGADO
  const [loading, setLoading] = useState(true)
  const [emailReporte, setEmailReporte] = useState('')

  useEffect(() => {
    const fetchFullData = async () => {
      // 1. Fetch de llamadas
      const { data: calls } = await supabase
        .from('llamadas')
        .select(`*, concesionarios:concesionario_id (nombre)`)
      
      // 2. Fetch de Alias (AGREGADO)
      const { data: aliases } = await supabase.from('dispositivo_alias').select('*')
      const aMap: Record<string, string> = {}
      aliases?.forEach(a => aMap[a.dispositivo_id] = a.alias)
      
      setAliasMap(aMap)
      setLlamadas(calls || [])
      setLoading(false)
    }
    fetchFullData()
  }, [])

  const statsPorPuesto = useMemo((): PuestoStats[] => {
    const map: Record<string, PuestoStats> = {}
    
    llamadas.forEach(ll => {
      const id = ll.dispositivo_id || 'S/D'
      if (!map[id]) map[id] = { id, alias: aliasMap[id] || `Puesto ${id}`, total: 0, atendidas: 0 }
      
      const hora = new Date(ll.fecha_llamada).getHours()
      const esHorarioComercial = hora >= 7 && hora < 19

      if (esHorarioComercial) {
        map[id].total++
        if (ll.estado?.toUpperCase() === 'ATENDIDA') map[id].atendidas++
      } else if (ll.estado?.toUpperCase() === 'ATENDIDA') {
        map[id].total++
        map[id].atendidas++
      }
    });
    
    return Object.values(map)
      .filter(p => p.total > 0)
      .sort((a, b) => b.total - a.total)
  }, [llamadas, aliasMap])

  // ... (Resto de useMemos igual que tu original) ...
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

  const fugasPorConcesionario = useMemo((): FugaStats[] => {
    const map: Record<string, number> = {}
    llamadas.filter(l => {
      const hora = new Date(l.fecha_llamada).getHours()
      return ['PERDIDA', 'RECHAZADA'].includes(l.estado?.toUpperCase() || '') && (hora >= 7 && hora < 19)
    }).forEach(ll => {
      const nombre = ll.concesionarios?.nombre || 'SIN VINCULAR'
      map[nombre] = (map[nombre] || 0) + 1
    })
    return Object.entries(map)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, 6)
  }, [llamadas])

  const totalEntrantes = llamadas.filter(l => l.tipo_llamada === 'ENTRANTE').length
  const totalSalientes = llamadas.filter(l => l.tipo_llamada === 'SALIENTE').length

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-black">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-red-600 border-b-4 border-transparent shadow-[0_0_20px_rgba(220,38,38,0.3)]" />
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000 px-4">
      <div className="border-b border-neutral-800 pb-10 mt-10 text-center lg:text-left relative overflow-hidden">
        <div className="absolute top-0 right-0 p-20 bg-red-600/5 blur-[100px] rounded-full" />
        <h1 className="text-6xl md:text-8xl font-black text-white italic uppercase tracking-tighter leading-none relative">
          BI <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">CRUCI</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4 italic">
          Auditoría de Red Operativa (v2.0) | Franja Comercial: 07:00 - 19:00
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-between group hover:border-red-600/50 transition-all relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 text-neutral-800/20 group-hover:text-red-600/10 transition-colors">
            <TrendingUp size={80} />
          </div>
          <div className="relative z-10">
            <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest italic mb-4">Volumen Total Red</p>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-6xl font-black text-white italic tracking-tighter group-hover:scale-105 transition-transform">{llamadas.length}</span>
              <span className="text-neutral-600 text-[10px] font-bold uppercase mb-2 italic">Llamadas</span>
            </div>
            <div className="grid grid-cols-2 border-t border-neutral-800 pt-5 gap-4">
              <div className="flex flex-col"><div className="flex items-center gap-1 text-blue-500 font-black italic"><ArrowDownLeft size={14} /> {totalEntrantes}</div><span className="text-[8px] text-neutral-600 font-bold uppercase">Entrantes</span></div>
              <div className="flex flex-col"><div className="flex items-center gap-1 text-green-500 font-black italic"><ArrowUpRight size={14} /> {totalSalientes}</div><span className="text-[8px] text-neutral-600 font-bold uppercase">Salientes</span></div>
            </div>
          </div>
        </div>

        <MiniCard icon={<Zap />} label="Telefono con mas llamados" 
          value={statsPorPuesto[0]?.alias || 'N/A'} // MODIFICADO: Muestra Alias
          color="text-yellow-500" sub="MAYOR PRODUCTIVIDAD" />
        <MiniCard icon={<AlertTriangle />} label="Llamadas Perdidas" value={llamadas.filter(l => { const h = new Date(l.fecha_llamada).getHours(); return l.estado !== 'ATENDIDA' && (h >= 7 && h < 19)}).length} color="text-red-600" sub="7-19 HS COMERCIAL" glow />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl backdrop-blur-md hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-3 mb-10">
            <BarChart3 className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Rendimiento Operativo por Terminal</h3>
          </div>
          <div className="space-y-10">
            {statsPorPuesto.map((p) => {
              const porcentaje = Math.round((p.atendidas / p.total) * 100)
              return (
                <div key={p.id} className="group">
                  <div className="flex justify-between items-end mb-3">
                    {/* MODIFICADO: Muestra Alias en el gráfico */}
                    <span className="text-white font-black italic uppercase text-2xl group-hover:text-red-500 transition-all tracking-tighter">{p.alias}</span>
                    <div className="text-right">
                      <span className="text-white font-black italic text-xl">{porcentaje}%</span>
                      <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">{p.atendidas} de {p.total} Atendidas</p>
                    </div>
                  </div>
                  <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden p-[2px] border border-neutral-700 shadow-inner">
                    <div className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.3)] ${porcentaje > 70 ? 'bg-green-500' : porcentaje > 40 ? 'bg-yellow-500' : 'bg-red-600'}`} style={{ width: `${porcentaje}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl flex flex-col backdrop-blur-md hover:border-red-600/30 transition-all">
          <div className="flex items-center gap-3 mb-10">
            <Clock className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Densidad de Tráfico Horario</h3>
          </div>
          <div className="flex-1 flex items-end justify-between gap-1 h-64 border-b border-neutral-800 pb-4">
            {statsHorarias.map((count, i) => {
              const max = Math.max(...statsHorarias)
              const height = max > 0 ? (count / max) * 100 : 0
              const esHorarioLaboral = i >= 7 && i < 19
              return (
                <div key={i} className={`transition-all rounded-t-sm relative group flex-1 ${esHorarioLaboral ? 'bg-red-600 hover:bg-white' : 'bg-neutral-800 hover:bg-neutral-600'}`} style={{ height: `${height}%` }}>
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 whitespace-nowrap">{i}:00hs | {count} Lls</div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-6 text-[8px] font-black text-neutral-600 uppercase italic tracking-[0.2em] px-2">
            <span>00:00 AM</span><span className="text-red-600 animate-pulse">FRANJA AUDITADA (07-19)</span><span>11:59 PM</span>
          </div>
        </div>
      </div>

      <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl transition-all hover:border-red-600/20">
        <div className="flex items-center gap-3 mb-10"><AlertTriangle className="text-red-600" /><h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Ranking de Llamadas perdidas</h3></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {fugasPorConcesionario.map((f, idx) => (
             <div key={idx} className="flex items-center justify-between p-7 bg-black/40 border border-neutral-800 rounded-3xl group hover:border-red-600 transition-all shadow-lg">
                <div className="flex flex-col"><span className="text-white font-black italic uppercase text-xl leading-none group-hover:text-red-500 transition-colors tracking-tighter">{f.nombre}</span><span className="text-[8px] text-neutral-600 font-black mt-2 uppercase italic tracking-widest">Atención en Riesgo</span></div>
                <div className="bg-red-600/10 px-5 py-2 rounded-2xl border border-red-600/20 shadow-inner group-hover:bg-red-600 group-hover:text-white transition-all"><span className="font-black text-2xl italic leading-none">{f.cantidad}</span></div>
             </div>
           ))}
        </div>
      </div>
      
      {/* Footer Email igual que el original */}
      <div className="bg-red-600 p-12 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-red-600/30 relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[80px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
        <div className="text-center lg:text-left relative z-10"><div className="flex items-center justify-center lg:justify-start gap-4 mb-3 text-white"><Mail size={40} className="drop-shadow-lg" /><h3 className="text-4xl font-black italic uppercase leading-none tracking-tighter">Reportes Semanales</h3></div><p className="text-white/80 text-[11px] font-bold uppercase tracking-[0.2em] italic">Análisis de eficiencia operativa y auditoría de red industrial</p></div>
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto relative z-10"><input type="email" placeholder="ADMIN@CRUCIANELLI.COM" className="bg-black/20 border-2 border-white/20 rounded-2xl px-8 py-5 text-white placeholder:text-white/40 text-xs font-black outline-none focus:border-white focus:bg-black/40 transition-all w-full lg:w-80 uppercase italic" onChange={(e) => setEmailReporte(e.target.value)} /><button onClick={() => alert(`Suscripción activada para ${emailReporte}`)} className="bg-white text-red-600 px-10 py-5 rounded-2xl font-black uppercase text-[10px] italic hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 group shadow-2xl">Suscripción BI <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" /></button></div>
      </div>
    </div>
  )
}

function MiniCard({ icon, label, value, sub = "", color = "text-red-600", glow = false }: any) {
  return (
    <div className={`bg-neutral-900 border border-neutral-800 p-9 rounded-[2.5rem] flex items-center gap-6 group hover:border-white transition-all shadow-2xl relative overflow-hidden ${glow ? 'hover:shadow-red-900/20' : ''}`}>
      <div className={`bg-neutral-800 p-5 rounded-2xl ${color} group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner group-hover:scale-110 transition-transform`}>{icon}</div>
      <div className="relative z-10"><p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-3 italic">{label}</p><p className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-red-500 transition-colors">{value}</p>{sub && <p className="text-[8px] text-neutral-600 font-bold uppercase mt-2 tracking-widest leading-none">{sub}</p>}</div>
    </div>
  )
}