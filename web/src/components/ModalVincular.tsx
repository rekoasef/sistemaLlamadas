'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, X, Check, Loader2 } from 'lucide-react'

interface Props {
  numero: string
  onClose: () => void
  onSuccess: () => void
}

export default function ModalVincular({ numero, onClose, onSuccess }: Props) {
  const [concesionarios, setConcesionarios] = useState<any[]>([])
  const [filtro, setFiltro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('concesionarios').select('*').order('nombre')
      if (data) setConcesionarios(data)
    }
    load()
  }, [])

  const vincular = async (id: string) => {
    if (loading) return
    setLoading(true)

    const numeroLimpio = numero.replace(/\D/g, '')
    
    try {
        const { error } = await supabase
          .from('concesionarios')
          .update({ telefono: numeroLimpio })
          .eq('id', id)
      
      if (error) {
        console.error("Error de Supabase:", error.message)
        alert("Error al vincular: " + error.message)
      } else {
        // Ejecutamos el cierre y la actualización
        onSuccess()
        onClose()
      }
    } catch (e) {
      console.error("Error inesperado:", e)
    } finally {
      setLoading(false)
    }
  }

  const filtrados = concesionarios.filter(c => 
    c.nombre.toLowerCase().includes(filtro.toLowerCase())
  )

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]">
        
        {/* HEADER */}
        <div className="p-6 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/20">
          <div>
            <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">Vincular Concesionario</h3>
            <p className="text-red-500 font-mono text-xs mt-1 font-bold">{numero}</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-neutral-500 hover:text-white p-2 hover:bg-neutral-800 rounded-full transition-all"
          >
            <X size={20}/>
          </button>
        </div>

        {/* BUSCADOR */}
        <div className="p-4">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={16} />
            <input 
              autoFocus
              className="w-full bg-black border border-neutral-800 rounded-2xl py-3 pl-12 pr-4 text-sm text-white focus:border-red-600 outline-none transition-all"
              placeholder="Buscar por nombre (ej: Criolani)..."
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
            />
          </div>

          {/* LISTA */}
          <div className="max-h-[350px] overflow-y-auto space-y-1 pr-2 custom-scroll">
            {filtrados.length > 0 ? (
              filtrados.map(c => (
                <button 
                  key={c.id}
                  onClick={() => vincular(c.id)}
                  disabled={loading}
                  className="w-full text-left px-4 py-3 rounded-xl hover:bg-red-600/10 hover:text-red-500 text-neutral-400 text-xs font-bold uppercase transition-all flex justify-between items-center group disabled:opacity-50"
                >
                  <span className="group-hover:translate-x-1 transition-transform">{c.nombre}</span>
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} className="opacity-0 group-hover:opacity-100" />}
                </button>
              ))
            ) : (
              <p className="text-center py-10 text-neutral-600 text-[10px] font-bold uppercase tracking-widest">No se encontraron resultados</p>
            )}
          </div>
        </div>

        <div className="p-4 bg-neutral-800/10 text-center border-t border-neutral-800">
             <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-[0.2em]">Red Oficial de Ventas Crucianelli</p>
        </div>
      </div>
    </div>
  )
}
