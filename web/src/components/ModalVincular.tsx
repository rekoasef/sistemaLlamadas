'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, Building2, Search, Check, AlertTriangle } from 'lucide-react'

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
  
  // ESTADO PARA DOBLE CONFIRMACIÓN
  const [confirmingAction, setConfirmingAction] = useState<{type: 'select' | 'create', id?: string} | null>(null)

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

  // FUNCIÓN PARA VERIFICAR SI EL NÚMERO YA EXISTE
  const verificarDuplicado = async () => {
    const { data, error } = await supabase
      .from('concesionario_telefonos')
      .select('concesionarios(nombre)')
      .eq('numero_telefono', numero)
      .maybeSingle()
    
    if (data) {
      alert(`ERROR CRÍTICO: Este número ya está asignado a "${(data as any).concesionarios.nombre}". No se puede duplicar en la agenda.`)
      return true
    }
    return false
  }

  const vincularExistente = async (concesionarioId: string) => {
    setLoading(true)
    try {
      const esDuplicado = await verificarDuplicado()
      if (esDuplicado) return

      const { error } = await supabase
        .from('concesionario_telefonos')
        .insert([{ 
          concesionario_id: concesionarioId, 
          numero_telefono: numero,
          nombre_referencia: 'Vendedor / Sucursal' 
        }])

      if (error) throw error
      onSuccess()
      onClose()
    } catch (err: any) {
      console.error("Error al vincular:", err)
      if (err?.code === '42501') {
        alert("No tenés permisos para vincular (RLS). Verificá que tu sesión siga activa e iniciá sesión de nuevo.")
      } else {
        alert("Error al procesar la vinculación: " + (err?.message || "consulte el log"))
      }
    } finally {
      setLoading(false)
      setConfirmingAction(null)
    }
  }

const handleCrearYVincular = async () => {
    if (!nombreNuevo || !numero) return; // Verificamos que ambos existan
    setLoading(true);
    
    try {
      // 1. Crear el concesionario con su campo obligatorio
      const { data: nuevoC, error: errC } = await supabase
        .from('concesionarios')
        .insert([
          { 
            nombre: nombreNuevo.toUpperCase(),
            telefono_principal: numero, // Campo requerido por la DB
            localidad: 'PENDIENTE' 
          }
        ])
        .select()
        .single();

      if (errC) throw errC;

      // 2. Vincular en la tabla de teléfonos (Agenda)
      const { error: errT } = await supabase
        .from('concesionario_telefonos')
        .upsert({ 
          numero_telefono: numero,
          concesionario_id: nuevoC.id, 
          nombre_referencia: 'Principal' 
        }, { onConflict: 'numero_telefono' });

      if (errT) throw errT;

      onSuccess(); 
      onClose();
    } catch (err: any) {
      console.error("Error detallado:", err);
      // Manejo específico para el usuario
      if (err.code === '23502') {
        alert(`Error: El campo ${err.column || 'teléfono'} es obligatorio en la base de datos.`);
      } else {
        alert("Error en la creación: " + (err.message || "Consulte el log"));
      }
    } finally {
      setLoading(false);
      setConfirmingAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in duration-300 relative">
        
        {/* MODAL DE CONFIRMACIÓN SUPERPUESTO */}
        {confirmingAction && (
          <div className="absolute inset-0 z-[110] bg-red-600 flex flex-col items-center justify-center p-10 text-center animate-in fade-in duration-200">
            <AlertTriangle size={60} className="text-white mb-4 animate-bounce" />
            <h3 className="text-white font-black italic text-3xl uppercase tracking-tighter mb-2">¿Estás Seguro?</h3>
            <p className="text-white/80 text-xs font-bold uppercase tracking-widest mb-8">
              Vas a vincular el número {numero} a {confirmingAction.type === 'create' ? nombreNuevo : 'este concesionario'}.
            </p>
            <div className="flex gap-4 w-full">
              <button 
                onClick={() => setConfirmingAction(null)}
                className="flex-1 py-4 bg-black/20 hover:bg-black/40 text-white rounded-2xl font-black uppercase text-[10px] transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={() => confirmingAction.type === 'create' ? handleCrearYVincular() : vincularExistente(confirmingAction.id!)}
                className="flex-1 py-4 bg-white text-red-600 rounded-2xl font-black uppercase text-[10px] shadow-xl transition-all active:scale-95"
              >
                Sí, Confirmar
              </button>
            </div>
          </div>
        )}

        {/* Header */}
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

        {/* Tabs */}
        <div className="flex border-b border-neutral-800">
          <button onClick={() => setMode('select')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'select' ? 'bg-red-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Elegir Existente</button>
          <button onClick={() => setMode('create')} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'create' ? 'bg-red-600 text-white' : 'text-neutral-500 hover:text-neutral-300'}`}>Nuevo Registro</button>
        </div>

        <div className="p-10">
          {mode === 'select' ? (
            <div className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600" size={18} />
                <input 
                  type="text" placeholder="BUSCAR EN LA AGENDA..." value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase"
                />
              </div>
              <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                {concesionarios.filter(c => c.nombre.toLowerCase().includes(filter.toLowerCase())).map(c => (
                  <button
                    key={c.id}
                    onClick={() => setConfirmingAction({type: 'select', id: c.id})}
                    className="w-full flex items-center justify-between p-5 bg-neutral-800/30 border border-neutral-800 rounded-2xl hover:border-red-600 transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-white font-black italic uppercase group-hover:text-red-500">{c.nombre}</p>
                      <p className="text-neutral-600 text-[9px] font-mono uppercase">{c.localidad || 'Ubicación no definida'}</p>
                    </div>
                    <Check className="text-red-600 opacity-0 group-hover:opacity-100" size={20} />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-[0.3em] mb-3 italic">Razón Social / Nombre</label>
              <input 
                type="text" value={nombreNuevo} onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="EJ: MAQUINARIAS RAFAELA"
                className="w-full bg-black border border-neutral-800 rounded-2xl p-5 text-white font-black italic focus:border-red-600 outline-none uppercase text-xl"
              />
              <button
                disabled={!nombreNuevo}
                onClick={() => setConfirmingAction({type: 'create'})}
                className="w-full bg-red-600 hover:bg-red-700 text-white py-5 rounded-2xl font-black italic uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl transition-all disabled:opacity-50"
              >
                <Save size={20} /> GUARDAR Y VINCULAR
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}