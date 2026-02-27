'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Phone, Trash2, Plus, Building2, MapPin, Hash } from 'lucide-react'

interface Props {
  concesionario: any
  onClose: () => void
  onSuccess: () => void
}

export default function ModalEditarConcesionario({ concesionario, onClose, onSuccess }: Props) {
  const [nombre, setNombre] = useState(concesionario.nombre || '')
  const [localidad, setLocalidad] = useState(concesionario.localidad || '')
  const [telefonos, setTelefonos] = useState<any[]>([])
  const [nuevoTel, setNuevoTel] = useState('')
  const [loading, setLoading] = useState(false)

  // Cargar todos los números asociados a este concesionario
  const fetchTelefonos = useCallback(async () => {
    const { data } = await supabase
      .from('concesionario_telefonos')
      .select('*')
      .eq('concesionario_id', concesionario.id)
    setTelefonos(data || [])
  }, [concesionario.id])

  useEffect(() => {
    if (concesionario.id) {
      fetchTelefonos()
    }
  }, [concesionario.id, fetchTelefonos])

  // Actualizar Nombre y Localidad
  const handleUpdateBase = async () => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('concesionarios')
        .update({ 
          nombre: nombre.toUpperCase(), 
          localidad: localidad.toUpperCase() 
        })
        .eq('id', concesionario.id)

      if (error) throw error
      onSuccess()
      alert("DATOS ACTUALIZADOS CORRECTAMENTE")
    } catch (err) {
      console.error(err)
      alert("ERROR AL ACTUALIZAR")
    } finally {
      setLoading(false)
    }
  }

  // Agregar un nuevo número a este concesionario
  const addTelefono = async () => {
    if (!nuevoTel) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('concesionario_telefonos')
        .insert([{ 
          concesionario_id: concesionario.id, 
          numero_telefono: nuevoTel, 
          nombre_referencia: 'ADICIONAL' 
        }])
      
      if (error) throw error
      
      setNuevoTel('')
      fetchTelefonos()
      onSuccess()
    } catch (err: any) {
      alert("ESTE NÚMERO YA EXISTE EN OTRO CONCESIONARIO")
    } finally {
      setLoading(false)
    }
  }

  // Eliminar un número específico
  const deleteTelefono = async (id: string) => {
    if (!window.confirm("¿ELIMINAR ESTE NÚMERO DE LA AGENDA?")) return
    await supabase.from('concesionario_telefonos').delete().eq('id', id)
    fetchTelefonos()
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-[3rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        
        {/* HEADER */}
        <div className="px-10 py-8 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/20">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-600 rounded-2xl text-white shadow-lg shadow-red-900/40">
              <Building2 size={24} />
            </div>
            <div>
              <h2 className="text-white font-black italic uppercase tracking-tighter text-2xl leading-none">Configuración de Terminal</h2>
              <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-2 italic">ID: {concesionario.id?.split('-')[0]}...</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
          
          {/* COLUMNA IZQ: INFO PRINCIPAL */}
          <div className="space-y-8">
            <div className="flex items-center gap-2 text-red-600">
              <Hash size={14} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Datos de Identidad</h3>
            </div>

            <div className="space-y-5">
              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">Razón Social</label>
                <div className="relative">
                   <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                   <input 
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase transition-all"
                    value={nombre} onChange={e => setNombre(e.target.value)}
                  />
                </div>
              </div>

              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">Localidad / Provincia</label>
                <div className="relative">
                   <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                   <input 
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase transition-all"
                    value={localidad} onChange={e => setLocalidad(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <button 
              onClick={handleUpdateBase}
              disabled={loading}
              className="w-full py-5 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-red-600 hover:text-white transition-all text-xs tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
            >
              <Save size={18} className="inline mr-2" /> {loading ? 'Sincronizando...' : 'Guardar Cambios'}
            </button>
          </div>

          {/* COLUMNA DER: TERMINALES ASOCIADAS */}
          <div className="space-y-8 bg-black/30 p-8 rounded-[2rem] border border-neutral-800/50">
            <div className="flex items-center gap-2 text-red-600">
              <Phone size={14} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Números Vinculados</h3>
            </div>
            
            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
              {telefonos.length > 0 ? telefonos.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 bg-neutral-900 border border-neutral-800 rounded-xl group hover:border-neutral-600 transition-all">
                  <div className="flex flex-col">
                    <span className="text-white font-mono text-sm tracking-tighter">{t.numero_telefono}</span>
                    <span className="text-[8px] text-neutral-600 font-black uppercase italic">{t.nombre_referencia}</span>
                  </div>
                  <button 
                    onClick={() => deleteTelefono(t.id)} 
                    className="p-2 text-neutral-700 hover:text-red-600 hover:bg-red-600/10 rounded-lg transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )) : (
                <p className="text-neutral-700 text-[10px] font-bold italic uppercase text-center py-10">Sin números registrados</p>
              )}
            </div>

            <div className="pt-6 border-t border-neutral-800">
              <label className="text-[9px] font-black text-neutral-500 uppercase mb-3 block text-center italic tracking-widest">Agregar Nueva Línea</label>
              <div className="flex gap-2">
                <input 
                  placeholder="+54 9..."
                  className="flex-1 bg-black border border-neutral-800 rounded-xl p-4 text-white font-mono text-sm focus:border-red-600 outline-none placeholder:text-neutral-800"
                  value={nuevoTel} onChange={e => setNuevoTel(e.target.value)}
                />
                <button 
                  onClick={addTelefono}
                  className="p-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                >
                  <Plus size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}