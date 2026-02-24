'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Save, Loader2, ArrowLeft } from 'lucide-react'

export default function DetalleConcesionario() {
  const { id } = useParams()
  const [form, setForm] = useState({ nombre: '', ubicacion: '', telefono: '' })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // 1. Cargar datos (Priorizando el LocalStorage si existe)
  const fetchData = useCallback(async () => {
    // Intentar leer respaldo local primero para evitar ver datos viejos
    const localBackup = localStorage.getItem(`backup_${id}`)
    
    const { data: dbData } = await supabase.from('concesionarios').select('*').eq('id', id).single()

    if (localBackup) {
      console.log("📦 Usando datos locales guardados");
      setForm(JSON.parse(localBackup))
    } else if (dbData) {
      setForm({
        nombre: dbData.nombre || '',
        ubicacion: dbData.ubicacion || '',
        telefono: dbData.telefono || ''
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setIsSaving(true)
    const payload = {
      nombre: form.nombre.toUpperCase().trim(),
      ubicacion: form.ubicacion.toUpperCase().trim(),
      telefono: form.telefono.trim()
    }

    // 2. Guardar Localmente de inmediato
    localStorage.setItem(`backup_${id}`, JSON.stringify(payload))

    // 3. Intentar guardar en la nube
    const { error } = await supabase.from('concesionarios').update(payload).eq('id', id)

    if (error) {
      alert("Error en DB: " + error.message)
      setIsSaving(false)
    } else {
      console.log("✅ Guardado en DB y LocalStorage");
      // Forzamos el refresco. Al volver, el componente leerá el LocalStorage
      window.location.reload()
    }
  }

  if (loading) return <div className="p-10 text-white font-black italic">SINCRO...</div>

  return (
    <div className="p-10 space-y-10 bg-[#0a0a0a] min-h-screen text-white">
      <div className="flex justify-between items-center border-b border-neutral-800 pb-10">
        <div className="space-y-4">
          <h1 className="text-6xl font-black uppercase italic text-red-600 tracking-tighter">
            {isSaving ? 'GUARDANDO...' : form.nombre || 'SIN NOMBRE'}
          </h1>
          <p className="text-neutral-500 font-mono text-xs uppercase tracking-widest">ID: {id}</p>
        </div>
        <button 
          onClick={handleSave}
          className="bg-white text-black px-12 py-5 rounded-2xl font-black uppercase italic hover:bg-red-600 hover:text-white transition-all shadow-2xl"
        >
          {isSaving ? 'SINCRONIZANDO...' : 'CONFIRMAR CAMBIOS'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        <div className="space-y-2">
          <label className="text-neutral-600 text-[10px] font-black uppercase tracking-widest">Nombre Comercial</label>
          <input 
            className="w-full bg-neutral-900 border border-neutral-800 p-6 rounded-3xl text-xl font-black uppercase italic outline-none focus:border-red-600 transition-all"
            value={form.nombre}
            onChange={e => setForm({...form, nombre: e.target.value})}
          />
        </div>
        <div className="space-y-2">
          <label className="text-neutral-600 text-[10px] font-black uppercase tracking-widest">Ubicación</label>
          <input 
            className="w-full bg-neutral-900 border border-neutral-800 p-6 rounded-3xl text-xl font-black uppercase italic outline-none focus:border-red-600 transition-all"
            value={form.ubicacion}
            onChange={e => setForm({...form, ubicacion: e.target.value})}
          />
        </div>
      </div>
      
      {/* Botón para limpiar el respaldo si ya se sincronizó bien */}
      <button 
        onClick={() => { localStorage.removeItem(`backup_${id}`); window.location.reload(); }}
        className="text-[10px] text-neutral-700 hover:text-red-500 font-black uppercase tracking-widest"
      >
        Limpiar respaldo local (Reset Cache)
      </button>
    </div>
  )
}