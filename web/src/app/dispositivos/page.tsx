'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Monitor, Edit3, Save, X, Activity, Smartphone } from 'lucide-react'

export default function DispositivosPage() {
  const [dispositivos, setDispositivos] = useState<any[]>([])
  const [aliasList, setAliasList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newAlias, setNewAlias] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    
    // 1. Obtener todos los IDs únicos de dispositivos que han llamado
    const { data: llamadas } = await supabase
      .from('llamadas')
      .select('dispositivo_id')
    
    const uniqueIds = Array.from(new Set(llamadas?.map(l => l.dispositivo_id)))

    // 2. Obtener los alias existentes
    const { data: aliasData } = await supabase
      .from('dispositivo_alias')
      .select('*')

    setAliasList(aliasData || [])
    
    // 3. Cruzar datos para el panel
    const list = uniqueIds.map(id => {
      const aliasObj = aliasData?.find(a => a.dispositivo_id === id)
      return {
        id,
        alias: aliasObj ? aliasObj.alias : `Terminal ${id}`,
        isRegistered: !!aliasObj
      }
    })

    setDispositivos(list)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const saveAlias = async (dispositivoId: string) => {
    const { error } = await supabase
      .from('dispositivo_alias')
      .upsert({ dispositivo_id: dispositivoId, alias: newAlias }, { onConflict: 'dispositivo_id' })

    if (!error) {
      setEditingId(null)
      fetchData()
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 pt-10 animate-in fade-in duration-700">
      
      <div className="border-b border-neutral-800 pb-8">
        <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
          GESTIÓN DE <span className="text-red-600">TERMINALES</span>
        </h1>
        <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-2 italic">
          Asignación de nombres y puestos de red
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {dispositivos.map((d) => (
          <div key={d.id} className="group bg-neutral-900/40 border border-neutral-800 p-8 rounded-[2.5rem] hover:border-red-600/50 transition-all relative overflow-hidden">
            
            <div className="relative z-10 space-y-6">
              <div className="flex justify-between items-start">
                <div className="p-4 bg-neutral-800 rounded-2xl text-red-600">
                  <Smartphone size={24} />
                </div>
                {editingId !== d.id ? (
                  <button 
                    onClick={() => { setEditingId(d.id); setNewAlias(d.alias); }}
                    className="p-2 text-neutral-500 hover:text-white transition-colors"
                  >
                    <Edit3 size={18} />
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => setEditingId(null)} className="p-2 text-neutral-500 hover:text-red-600"><X size={18}/></button>
                    <button onClick={() => saveAlias(d.id)} className="p-2 text-green-500 hover:text-green-400"><Save size={18}/></button>
                  </div>
                )}
              </div>

              <div>
                {editingId === d.id ? (
                  <input 
                    autoFocus
                    value={newAlias}
                    onChange={(e) => setNewAlias(e.target.value)}
                    className="w-full bg-black border border-red-600 rounded-xl p-3 text-white font-black italic uppercase text-xl outline-none"
                  />
                ) : (
                  <>
                    <h3 className="text-4xl font-black italic uppercase text-white tracking-tighter">{d.alias}</h3>
                    <p className="text-neutral-600 font-mono text-[10px] mt-1 tracking-[0.2em]">ID TÉCNICO: ST-{d.id}</p>
                  </>
                )}
              </div>

              <div className="pt-6 border-t border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[9px] font-black text-neutral-500 uppercase tracking-widest">En Línea</span>
                </div>
                <Activity size={16} className="text-neutral-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}