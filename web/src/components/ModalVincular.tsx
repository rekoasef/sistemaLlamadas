'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Building2 } from 'lucide-react'

interface Props {
  numero: string
  onClose: () => void
  onSuccess: () => void
}

export default function ModalVincular({ numero, onClose, onSuccess }: Props) {
  const [nombre, setNombre] = useState('')
  const [localidad, setLocalidad] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    // 1. Insertamos el nuevo concesionario
    const { error } = await supabase
      .from('concesionarios')
      .insert([{ 
        nombre: nombre.toUpperCase(), 
        telefono_principal: numero,
        localidad: localidad 
      }])

    if (error) {
      alert("Error al vincular: " + error.message)
    } else {
      onSuccess()
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        <div className="p-8 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/30">
          <div className="flex items-center gap-3">
            <Building2 className="text-red-600" size={20} />
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Vincular Concesionario</h3>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div>
            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-2 block">Número Detectado</label>
            <input 
              type="text" 
              value={numero} 
              disabled 
              className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-neutral-400 font-mono text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-2 block italic">Nombre de la Empresa</label>
            <input 
              type="text" 
              required
              autoFocus
              placeholder="EJ: AGRICOLA RAFAELA S.A."
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full bg-black border border-neutral-800 focus:border-red-600 rounded-xl px-4 py-3 text-white outline-none transition-all uppercase font-bold"
            />
          </div>

          <div>
            <label className="text-[9px] font-black uppercase text-neutral-500 tracking-widest mb-2 block italic">Localidad</label>
            <input 
              type="text" 
              placeholder="EJ: RAFAELA, SANTA FE"
              value={localidad}
              onChange={(e) => setLocalidad(e.target.value)}
              className="w-full bg-black border border-neutral-800 focus:border-red-600 rounded-xl px-4 py-3 text-white outline-none transition-all"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-neutral-800 text-white font-black py-4 rounded-xl flex items-center justify-center gap-2 transition-all uppercase text-xs tracking-[0.2em] italic"
          >
            {loading ? 'Procesando...' : <><Save size={16} /> Guardar Concesionario</>}
          </button>
        </form>
      </div>
    </div>
  )
}