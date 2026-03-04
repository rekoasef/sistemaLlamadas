'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { 
  Building2, 
  Phone, 
  MapPin, 
  Edit3, 
  Trash2, 
  Plus, 
  Search,
  ChevronRight,
  RefreshCw,
  BarChart3
} from 'lucide-react'
import ModalEditarConcesionario from '@/components/ModalEditarConcesionario'

export default function ConcesionariosPage() {
  const [concesionarios, setConcesionarios] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [selectedConcesionario, setSelectedConcesionario] = useState<any>(null)

  const fetchConcesionarios = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('concesionarios')
        .select(`
          *,
          concesionario_telefonos (count)
        `)
        .order('nombre', { ascending: true })

      if (error) throw error
      setConcesionarios(data || [])
    } catch (err) {
      console.error('Error al cargar agenda:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConcesionarios()
  }, [fetchConcesionarios])

  const filtered = concesionarios.filter(c => 
    c.nombre?.toLowerCase().includes(filter.toLowerCase()) ||
    c.localidad?.toLowerCase().includes(filter.toLowerCase())
  )

  const handleDelete = async (id: string, nombre: string) => {
    const confirm = window.confirm(`¿ESTÁS SEGURO DE ELIMINAR A "${nombre}"?`)
    if (!confirm) return

    const { error } = await supabase
      .from('concesionarios')
      .delete()
      .eq('id', id)

    if (!error) fetchConcesionarios()
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20 px-4">
      
      {selectedConcesionario && (
        <ModalEditarConcesionario 
          concesionario={selectedConcesionario}
          onClose={() => setSelectedConcesionario(null)}
          onSuccess={fetchConcesionarios}
        />
      )}

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between border-b border-neutral-800 pb-8 gap-6 mt-10">
        <div>
          <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
            AGENDA <span className="text-red-600">RED</span>
          </h1>
          <div className="flex items-center gap-2 mt-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] italic">
              GESTIÓN CENTRALIZADA DE TERMINALES
            </p>
          </div>
        </div>

        <button 
          onClick={() => setSelectedConcesionario({ nombre: '', localidad: '', nuevo: true })}
          className="flex items-center gap-3 bg-red-600 hover:bg-red-700 text-white px-8 py-4 rounded-2xl font-black italic uppercase tracking-widest transition-all shadow-lg active:scale-95"
        >
          <Plus size={20} /> Nuevo Concesionario
        </button>
      </div>

      {/* FILTROS */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-neutral-600" size={20} />
          <input 
            type="text"
            placeholder="BUSCAR CONCESIONARIO..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full bg-neutral-900/50 border border-neutral-800 rounded-2xl py-5 pl-14 pr-6 text-white font-bold italic focus:border-red-600 outline-none transition-all uppercase"
          />
        </div>
        <button onClick={fetchConcesionarios} className="p-5 bg-neutral-900/50 border border-neutral-800 rounded-2xl text-neutral-500 hover:text-white transition-all">
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* GRILLA */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filtered.map((c) => (
          <div key={c.id} className="group bg-neutral-900/40 border border-neutral-800 p-8 rounded-[2.5rem] hover:border-red-600 transition-all relative overflow-hidden">
            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-red-600/10 rounded-xl border border-red-600/20 text-red-600">
                  <Building2 size={24} />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedConcesionario(c)} className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={() => handleDelete(c.id, c.nombre)} className="p-2.5 bg-neutral-800 rounded-lg text-neutral-400 hover:text-red-600 transition-all">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <h3 className="text-3xl font-black italic uppercase text-white group-hover:text-red-500 transition-colors mb-2 leading-none tracking-tighter">
                {c.nombre}
              </h3>

              <div className="space-y-3 mt-8">
                <div className="flex items-center gap-3 text-neutral-500 text-[11px] font-black uppercase italic tracking-wider">
                  <MapPin size={14} className="text-red-600" />
                  {c.localidad || 'UBICACIÓN PENDIENTE'}
                </div>
                <div className="flex items-center gap-3 text-neutral-400 text-[11px] font-black uppercase italic tracking-wider">
                  <Phone size={14} className="text-red-600" />
                  {/* FIX: Leemos el count de la relación */}
                  {c.concesionario_telefonos?.[0]?.count || 0} LÍNEAS REGISTRADAS
                </div>
              </div>

              <Link 
                href={`/concesionarios/${c.id}`}
                className="w-full mt-10 py-4 bg-neutral-800 group-hover:bg-red-600 group-hover:text-white text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em] rounded-xl transition-all flex items-center justify-center gap-2 italic shadow-inner"
              >
                <BarChart3 size={14} /> VER DASHBOARD ANALÍTICO <ChevronRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}