'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Building2, Search, Check } from 'lucide-react'

interface Props {
  numero: string
  onClose: () => void
  onSuccess: () => void
}

export default function ModalVincular({ numero, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'select' | 'create'>('select')
  const [concesionarios, setConcesionarios] = useState<any[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')

  // Cargar lista de concesionarios para el buscador
  useEffect(() => {
    const loadConcesionarios = async () => {
      const { data } = await supabase
        .from('concesionarios')
        .select('*')
        .order('nombre', { ascending: true })
      if (data) setConcesionarios(data)
    }
    loadConcesionarios()
  }, [])

  const filtered = concesionarios.filter(c => 
    c.nombre.toLowerCase().includes(filter.toLowerCase())
  )

  /**
   * OPCIÓN 1: VINCULAR A CONCESIONARIO EXISTENTE
   * Agregamos el número a la agenda de ese concesionario.
   * El Trigger SQL 'tr_limpiar_historial_numero' actualizará todas las llamadas automáticamente.
   */
  const vincularExistente = async (concesionarioId: string) => {
    setLoading(true)
    try {
      const { error } = await supabase
        .from('concesionario_telefonos')
        .insert([{ 
          concesionario_id: concesionarioId, 
          numero_telefono: numero,
          nombre_referencia: 'Vendedor / Sucursal' 
        }])

      if (error) {
        // Si el número ya estaba en otro concesionario, avisamos
        if (error.code === '23505') {
          alert("ESTE NÚMERO YA PERTENECE A OTRO CONCESIONARIO EN LA AGENDA.")
          return
        }
        throw error
      }

      onSuccess() // Notifica al Dashboard para recargar
      onClose()   // Cierra el modal
    } catch (err) {
      console.error("Error al vincular:", err)
      alert("Error al procesar la vinculación.")
    } finally {
      setLoading(false)
    }
  }

  /**
   * OPCIÓN 2: CREAR NUEVO Y VINCULAR
   * Creamos el concesionario y luego le asignamos su primer número.
   * El Trigger se encargará del resto.
   */
  const handleCrearYVincular = async () => {
    if (!nombreNuevo) return
    setLoading(true)
    try {
      // 1. Creamos el concesionario base
      const { data: nuevoC, error: errC } = await supabase
        .from('concesionarios')
        .insert([{ nombre: nombreNuevo.toUpperCase() }])
        .select()
        .single()

      if (errC) throw errC

      // 2. Insertamos el número en la tabla de teléfonos vinculada
      // Esto dispara el trigger 'tr_limpiar_historial_numero' en la DB
      const { error: errT } = await supabase
        .from('concesionario_telefonos')
        .insert([{ 
          concesionario_id: nuevoC.id, 
          numero_telefono: numero,
          nombre_referencia: 'Principal' 
        }])

      if (errT) throw errT

      onSuccess() 
      onClose()
    } catch (err) {
      console.error("Error en creación:", err)
      alert("Error: Es posible que este número ya exista en la agenda.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300">
        
        {/* Header Estilo Industrial */}
        <div className="px-10 py-8 border-b border-neutral-800 flex justify-between items-center bg-neutral-800/20">
          <div>
            <h2 className="text-white font-black italic uppercase tracking-tighter text-2xl flex items-center gap-3">
              <Building2 className="text-red-600" size={24} /> Red Crucianelli
            </h2>
            <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1 italic">
              Vincular número: <span className="text-red-500">{numero}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tabs de Modo */}
        <div className="flex border-b border-neutral-800">
          <button 
            onClick={() => setMode('select')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'select' ? 'bg-red-600 text-white shadow-[inset_0_-2px_0_white]' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Elegir Existente
          </button>
          <button 
            onClick={() => setMode('create')}
            className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'create' ? 'bg-red-600 text-white shadow-[inset_0_-2px_0_white]' : 'text-neutral-500 hover:text-neutral-300'}`}
          >
            Nuevo Registro
          </button>
        </div>

        <div className="p-10">
          {mode === 'select' ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
                <input 
                  type="text"
                  placeholder="BUSCAR EN LA AGENDA..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none transition-all uppercase placeholder:text-neutral-700"
                />
              </div>
              
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                {filtered.map(c => (
                  <button
                    key={c.id}
                    disabled={loading}
                    onClick={() => vincularExistente(c.id)}
                    className="w-full flex items-center justify-between p-5 bg-neutral-800/30 border border-neutral-800 rounded-2xl hover:border-red-600 hover:bg-red-600/10 transition-all group disabled:opacity-50"
                  >
                    <div className="text-left">
                      <p className="text-white font-black italic uppercase group-hover:text-red-500 transition-colors">{c.nombre}</p>
                      <p className="text-neutral-600 text-[9px] font-mono tracking-tighter uppercase">{c.localidad || 'Ubicación no definida'}</p>
                    </div>
                    <Check className="text-red-600 opacity-0 group-hover:opacity-100 transition-all" size={20} />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-center text-neutral-600 font-bold italic py-10 uppercase text-xs">Sin coincidencias</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3 italic">Razón Social / Nombre</label>
                <input 
                  autoFocus
                  type="text"
                  value={nombreNuevo}
                  onChange={(e) => setNombreNuevo(e.target.value)}
                  placeholder="EJ: MAQUINARIAS RAFAELA"
                  className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-white font-black italic focus:border-red-600 outline-none transition-all uppercase text-xl"
                />
              </div>
              <button
                disabled={loading || !nombreNuevo}
                onClick={handleCrearYVincular}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-black italic uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-red-900/20 transition-all disabled:opacity-50"
              >
                <Save size={20} /> {loading ? 'SINCRONIZANDO...' : 'GUARDAR Y VINCULAR'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}