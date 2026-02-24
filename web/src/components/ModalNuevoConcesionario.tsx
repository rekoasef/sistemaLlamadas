'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Building2, MapPin, Phone } from 'lucide-react'

export default function ModalNuevoConcesionario({ onClose, onSuccess }: any) {
  const [formData, setFormData] = useState({ nombre: '', ubicacion: '', telefono: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    // Limpieza de número antes de guardar
    const numLimpio = formData.telefono.replace(/\D/g, '')

    const { error } = await supabase
      .from('concesionarios')
      .insert([{ 
        nombre: formData.nombre.toUpperCase(), 
        ubicacion: formData.ubicacion.toUpperCase(), 
        telefono: numLimpio 
      }])

    if (!error) {
      onSuccess()
      onClose()
    } else {
      alert("Error: " + error.message)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-8 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/20">
          <h3 className="text-white font-black italic uppercase tracking-tighter text-2xl">Nuevo Punto de Venta</h3>
          <button type="button" onClick={onClose} className="text-neutral-500 hover:text-white"><X /></button>
        </div>

        <div className="p-8 space-y-6">
          <div>
            <label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-2 block">Nombre del Concesionario</label>
            <div className="relative">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
              <input 
                required
                className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-red-600 transition-all"
                placeholder="EJ: CRIOLANI S.A."
                value={formData.nombre}
                onChange={e => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-2 block">Ubicación</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
                <input 
                  required
                  className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-red-600 transition-all"
                  placeholder="LOCALIDAD"
                  value={formData.ubicacion}
                  onChange={e => setFormData({...formData, ubicacion: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="text-neutral-500 text-[10px] font-black uppercase tracking-widest mb-2 block">Teléfono Inicial</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600" size={18} />
                <input 
                  required
                  className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold outline-none focus:border-red-600 transition-all"
                  placeholder="543471..."
                  value={formData.telefono}
                  onChange={e => setFormData({...formData, telefono: e.target.value})}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 bg-neutral-800/10 border-t border-neutral-800">
          <button 
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-2xl italic uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/20"
          >
            {loading ? "GUARDANDO..." : <><Save size={20} /> Registrar en Red</>}
          </button>
        </div>
      </form>
    </div>
  )
}