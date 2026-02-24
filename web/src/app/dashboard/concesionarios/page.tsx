'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Users, Phone, Search, Plus, MapPin } from 'lucide-react'

interface Concesionario {
  id: string
  nombre: string
  telefono: string
  localidad: string
}

export default function ConcesionariosPage() {
  const [concesionarios, setConcesionarios] = useState<Concesionario[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConcesionarios()
  }, [])

  const fetchConcesionarios = async () => {
    const { data } = await supabase.from('concesionarios').select('*').order('nombre', { ascending: true })
    if (data) setConcesionarios(data)
    setLoading(false)
  }

  const filtrados = concesionarios.filter(c => 
    c.nombre.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter">Concesionarios</h1>
          <p className="text-neutral-500 text-sm font-medium uppercase tracking-widest">Red Oficial Crucianelli</p>
        </div>
        <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all">
          <Plus size={16} /> Nuevo Concesionario
        </button>
      </div>

      {/* BARRA DE BÚSQUEDA */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
        <input 
          type="text"
          placeholder="Buscar concesionario por nombre..."
          className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 transition-colors"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* GRID DE CONCESIONARIOS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtrados.map((c) => (
          <div key={c.id} className="bg-neutral-900/50 border border-neutral-800 p-6 rounded-2xl hover:border-neutral-600 transition-all group">
            <h3 className="text-lg font-bold text-white mb-4 italic uppercase">{c.nombre}</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-neutral-400 text-sm">
                <Phone size={14} className="text-red-600" />
                <span className="font-mono">{c.telefono || 'Sin teléfono asignado'}</span>
              </div>
              <div className="flex items-center gap-3 text-neutral-400 text-sm">
                <MapPin size={14} />
                <span>Localidad no definida</span>
              </div>
            </div>
            <button className="mt-6 w-full py-2 bg-neutral-800 text-neutral-400 text-[10px] font-black uppercase rounded-lg hover:bg-red-600 hover:text-white transition-all">
              Gestionar Métricas y Datos
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}