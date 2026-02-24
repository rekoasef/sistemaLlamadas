'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Phone, Search, Plus, MapPin, Building2 } from 'lucide-react'
import Link from 'next/link'
import ModalNuevoConcesionario from '@/components/ModalNuevoConcesionario'

export default function ConcesionariosPage() {
  const [concesionarios, setConcesionarios] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const channelRef = useRef<any>(null)

  const fetchConcesionarios = async () => {
    const { data } = await supabase
      .from('concesionarios')
      .select('*')
      .order('nombre')

    if (data) setConcesionarios(data)
  }

  useEffect(() => {
    fetchConcesionarios()

    if (channelRef.current) return

    const channel = supabase
      .channel('realtime-concesionarios')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'concesionarios' },
        () => fetchConcesionarios()
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

  const filtrados = concesionarios.filter(c =>
    (c.nombre || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.ubicacion || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {showModal && (
        <ModalNuevoConcesionario
          onClose={() => setShowModal(false)}
          onSuccess={fetchConcesionarios}
        />
      )}

      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter">
            RED <span className="text-red-600">OFICIAL</span>
          </h1>
          <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em] mt-2 italic">
            Gestión de puntos de venta Crucianelli
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
        >
          <Plus size={18} strokeWidth={3} /> Nuevo Punto
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={20} />
        <input
          className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-neutral-700 outline-none focus:border-red-600 transition-all"
          placeholder="BUSCAR CONCESIONARIO O CIUDAD..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtrados.map((c) => (
          <div key={c.id} className="bg-neutral-900/30 border border-neutral-800 p-8 rounded-[2.5rem] hover:border-red-600/50 transition-all group relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-white mb-4 italic uppercase group-hover:text-red-500 transition-colors">
                {c.nombre}
              </h3>

              <div className="space-y-3">
                <div className="flex items-center gap-3 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
                  <Phone size={14} className="text-red-600" />
                  <span className="font-mono">{c.telefono ? `+${c.telefono}` : 'SIN TELÉFONO'}</span>
                </div>

                <div className="flex items-center gap-3 text-neutral-400 text-[11px] font-bold uppercase tracking-wider">
                  <MapPin size={14} className="text-red-600" />
                  <span>{c.ubicacion || 'UBICACIÓN NO DEFINIDA'}</span>
                </div>
              </div>

              <Link
                href={`/dashboard/concesionarios/${c.id}`}
                className="mt-8 w-full py-3 bg-neutral-800 text-neutral-400 text-[10px] font-black uppercase rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center tracking-[0.2em]"
              >
                Gestionar Punto
              </Link>
            </div>

            <Building2 className="absolute -right-4 -bottom-4 text-white/[0.02] group-hover:text-red-600/[0.05] transition-all" size={120} />
          </div>
        ))}
      </div>
    </div>
  )
}