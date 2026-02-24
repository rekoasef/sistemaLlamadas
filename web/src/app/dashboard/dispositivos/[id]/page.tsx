'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Smartphone, Save, Loader2, ArrowLeft, Cpu } from 'lucide-react'
import Link from 'next/link'

export default function DetalleDispositivo() {
  const { id } = useParams()
  const [form, setForm] = useState({ alias: '', imei: '', modelo: '' })
  const [loading, setLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    // 1. Prioridad: ¿Hay algo guardado localmente?
    const backup = localStorage.getItem(`dev_backup_${id}`)
    
    // 2. Traer de la nube
    const { data } = await supabase.from('dispositivos').select('*').eq('id', id).single()

    if (backup) {
      setForm(JSON.parse(backup))
    } else if (data) {
      setForm({
        alias: data.alias || '',
        imei: data.imei || '',
        modelo: data.modelo || ''
      })
    }
    setLoading(false)
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  const handleSave = async () => {
    setIsSaving(true)
    const payload = {
      alias: form.alias.toUpperCase().trim(),
      imei: form.imei.trim(),
      modelo: form.modelo.toUpperCase().trim()
    }

    // Guardado local inmediato
    localStorage.setItem(`dev_backup_${id}`, JSON.stringify(payload))

    // Guardado en Supabase
    const { error } = await supabase.from('dispositivos').update(payload).eq('id', id)

    if (error) {
      alert("Error en Nube: " + error.message)
      setIsSaving(false)
    } else {
      // Forzar recarga física
      window.location.reload()
    }
  }

  if (loading) return <div className="p-10 text-red-600 font-black animate-pulse uppercase">Sincronizando Hardware...</div>

  return (
    <div className="p-10 space-y-10 bg-[#0a0a0a] min-h-screen text-white">
      <div className="flex justify-between items-center border-b border-neutral-800 pb-10">
        <div className="space-y-4">
          <Link href="/dashboard/dispositivos" className="text-neutral-500 hover:text-white flex items-center gap-2 text-[10px] font-black uppercase tracking-widest italic">
            <ArrowLeft size={14}/> Volver a Inventario
          </Link>
          <h1 className="text-6xl font-black uppercase italic tracking-tighter leading-none">
            {isSaving ? 'Actualizando...' : form.alias || 'DISPOSITIVO'}
          </h1>
        </div>
        <button 
          onClick={handleSave}
          className="bg-white text-black px-12 py-5 rounded-2xl font-black uppercase italic hover:bg-red-600 hover:text-white transition-all shadow-2xl active:scale-95"
        >
          {isSaving ? 'GUARDANDO...' : 'CONFIRMAR DATOS'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl font-black italic">
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl space-y-3">
          <label className="text-neutral-600 text-[10px] uppercase tracking-widest flex items-center gap-2">
            <Smartphone size={12}/> Alias / Nombre
          </label>
          <input 
            className="w-full bg-black border border-neutral-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all uppercase"
            value={form.alias}
            onChange={e => setForm({...form, alias: e.target.value})}
          />
        </div>
        
        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl space-y-3">
          <label className="text-neutral-600 text-[10px] uppercase tracking-widest flex items-center gap-2">
            <Cpu size={12}/> IMEI / Serial
          </label>
          <input 
            className="w-full bg-black border border-neutral-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all font-mono"
            value={form.imei}
            onChange={e => setForm({...form, imei: e.target.value})}
          />
        </div>

        <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-3xl space-y-3">
          <label className="text-neutral-600 text-[10px] uppercase tracking-widest flex items-center gap-2">Modelo</label>
          <input 
            className="w-full bg-black border border-neutral-800 p-4 rounded-xl text-white outline-none focus:border-red-600 transition-all uppercase"
            value={form.modelo}
            onChange={e => setForm({...form, modelo: e.target.value})}
          />
        </div>
      </div>
      
      <p className="text-[10px] text-neutral-800 uppercase tracking-widest font-black italic">
        Cruci-Track Hard Sync Active v2.6
      </p>
    </div>
  )
}