'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  PhoneIncoming, PhoneOutgoing, Activity, UserPlus 
} from 'lucide-react'
import ModalVincular from '@/components/ModalVincular'

export default function DashboardPage() {
  const [llamadas, setLlamadas] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [selectedNum, setSelectedNum] = useState('')
  const [eventFlash, setEventFlash] = useState(false)

  const llamadasRef = useRef<any[]>([])
  const channelRef = useRef<any>(null)

  // =============================
  // FETCH INICIAL
  // =============================
  const fetchInicial = async () => {
    const { data, error } = await supabase
      .from('llamadas')
      .select(`*, concesionarios!numero_telefono_fkey(nombre)`)
      .order('fecha_llamada', { ascending: false })
      .limit(20)

    if (!error && data) {
      setLlamadas(data)
      llamadasRef.current = data
    }

    setLoading(false)
  }

  useEffect(() => {
    setMounted(true)
    fetchInicial()

    if (channelRef.current) return

    const channel = supabase
      .channel('cruci-live-industrial')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'llamadas' },
        async (payload) => {

          const { data, error } = await supabase
            .from('llamadas')
            .select(`*, concesionarios!numero_telefono_fkey(nombre)`)
            .eq('id', payload.new.id)
            .single()

          if (error || !data) return

          setLlamadas(prev => {
            const existe = prev.some(ll => ll.id === data.id)
            if (existe) return prev

            const nuevaLista = [data, ...prev]
            llamadasRef.current = nuevaLista
            return nuevaLista.slice(0, 20)
          })

          setEventFlash(true)
          setTimeout(() => setEventFlash(false), 2000)
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [])

  if (!mounted) return null

  if (loading && llamadas.length === 0) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-black">
        <div className="text-red-600 font-black italic animate-pulse text-2xl tracking-[0.5em]">
          CONECTANDO SISTEMA...
        </div>
      </div>
    )
  }

  const total = llamadas.length
  const atendidas = llamadas.filter(ll => ll.estado === 'ATENDIDA').length
  const tasa = total > 0 ? Math.round((atendidas / total) * 100) : 0
  const perdidas = llamadas.filter(
    ll => ll.estado === 'RECHAZADA' || ll.estado === 'PERDIDA'
  ).length

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {showModal && (
        <ModalVincular 
          numero={selectedNum} 
          onClose={() => setShowModal(false)} 
          onSuccess={fetchInicial} 
        />
      )}

      {/* HEADER INDUSTRIAL */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-6">
        <div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">
            PANEL <span className="text-red-600">GENERAL</span>
          </h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.3em] mt-2 italic">
            Flujo de red Crucianelli en vivo
          </p>
        </div>

        <div className={`flex items-center gap-3 px-5 py-2 rounded-xl border transition-all duration-500 ${
          eventFlash 
            ? 'bg-red-600 border-red-500 text-white' 
            : 'bg-green-600/10 border-green-500/20 text-green-500'
        }`}>
          <span className={`h-2 w-2 rounded-full ${
            eventFlash ? 'bg-white animate-ping' : 'bg-green-500 animate-pulse'
          }`} />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] italic font-mono">
            {eventFlash ? 'ACTUALIZANDO...' : 'ON LIVE'}
          </span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Registros" value={total} sub="Total" />
        <MetricCard label="Atención" value={`${tasa}%`} color="text-yellow-500" bar progress={tasa} />
        <MetricCard label="Perdidas" value={perdidas} color={perdidas > 0 ? 'text-red-600' : 'text-neutral-500'} sub="Crítico" />
      </div>

      {/* TABLA INDUSTRIAL */}
      <div className={`rounded-[2.5rem] border transition-all duration-700 overflow-hidden shadow-2xl backdrop-blur-md ${
        eventFlash ? 'border-red-600 shadow-red-600/30' : 'border-neutral-800 bg-neutral-900/30'
      }`}>
        <div className="px-10 py-6 border-b border-neutral-800/50 flex justify-between items-center bg-neutral-800/20">
          <h2 className="text-[10px] font-black text-white uppercase tracking-[0.4em] italic flex items-center gap-2">
            <Activity size={14} className="text-red-600" /> Actividad de Red
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-neutral-800/50">
              {llamadas.map((ll, idx) => (
                <tr key={`${ll.id}-${ll.fecha_llamada}`} className={`hover:bg-red-600/[0.04] transition-all group ${
                  idx === 0 && eventFlash ? 'bg-red-600/20' : ''
                }`}>
                  <td className="px-10 py-6">
                    <div className={`flex items-center gap-4 text-sm font-black italic uppercase ${
                      ll.tipo_llamada === 'ENTRANTE' ? 'text-blue-500' : 'text-purple-500'
                    }`}>
                      {ll.tipo_llamada === 'ENTRANTE'
                        ? <PhoneIncoming size={22} strokeWidth={3} />
                        : <PhoneOutgoing size={22} strokeWidth={3} />}
                      {ll.tipo_llamada}
                    </div>
                  </td>

                  <td className="px-10 py-6">
                    {ll.concesionarios?.nombre ? (
                      <div className="flex flex-col">
                        <span className="text-white font-black italic uppercase text-xl group-hover:text-red-500 transition-colors leading-none mb-1">
                          {ll.concesionarios.nombre}
                        </span>
                        <span className="text-xs text-neutral-600 font-mono italic tracking-tighter">
                          {ll.numero_telefono}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-neutral-500 text-sm italic">
                          {ll.numero_telefono}
                        </span>
                        <button
                          onClick={() => {
                            setSelectedNum(ll.numero_telefono)
                            setShowModal(true)
                          }}
                          className="p-2.5 bg-neutral-800 rounded-xl text-neutral-500 hover:bg-red-600 hover:text-white transition-all shadow-xl"
                        >
                          <UserPlus size={18} />
                        </button>
                      </div>
                    )}
                  </td>

                  <td className="px-10 py-6 text-center">
                    <span className={`px-6 py-2 rounded-full text-[11px] font-black uppercase border transition-all ${
                      ll.estado === 'ATENDIDA'
                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                        : 'bg-red-600/10 text-red-600 border-red-600/20'
                    }`}>
                      {ll.estado}
                    </span>
                  </td>

                  <td className="px-10 py-6 text-center text-neutral-400 font-mono text-sm">
                    {ll.duracion_segundos}s
                  </td>

                  <td className="px-10 py-6 text-right font-black italic font-mono">
                    <p className="text-white text-lg leading-none mb-1">
                      {new Date(ll.fecha_llamada).toLocaleTimeString('es-AR')}
                    </p>
                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest italic">
                      Terminal {ll.dispositivo_id}
                    </p>
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

function MetricCard({ label, value, sub = "", color = "text-white", bar = false, progress = 0 }: any) {
  return (
    <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[2rem] transition-all duration-500">
      <p className="text-neutral-600 text-[10px] font-black uppercase tracking-[0.3em]">
        {label}
      </p>
      <div className="flex items-baseline gap-4 mt-4">
        <h3 className={`text-7xl font-black italic tracking-tighter ${color}`}>
          {value}
        </h3>
        <span className="text-neutral-600 text-xs font-bold uppercase italic tracking-widest">
          {sub}
        </span>
      </div>
      {bar && (
        <div className="w-full bg-neutral-800 h-2 mt-8 rounded-full overflow-hidden">
          <div
            className="bg-red-600 h-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
}