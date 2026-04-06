'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  X, Save, Phone, Trash2, Plus, Building2, MapPin, Hash, Search,
  CheckCircle, Loader2,
} from 'lucide-react'
import { buscarLocalidades, type LocalidadSugerencia } from '@/services/geocoding.service'

interface Props {
  concesionario: any
  onClose: () => void
  onSuccess: () => void
}

export default function ModalEditarConcesionario({ concesionario, onClose, onSuccess }: Props) {
  const isNuevo = !concesionario.id
  const [nombre, setNombre] = useState(concesionario.nombre || '')
  const [localidad, setLocalidad] = useState(concesionario.localidad || '')
  const [ciudad, setCiudad] = useState(concesionario.ciudad || '')
  const [provincia, setProvincia] = useState(concesionario.provincia || '')
  const [latitud, setLatitud] = useState<number | null>(concesionario.latitud ?? null)
  const [longitud, setLongitud] = useState<number | null>(concesionario.longitud ?? null)
  const [telefonoPrincipal, setTelefonoPrincipal] = useState(concesionario.telefono_principal || '')
  const [telefonos, setTelefonos] = useState<any[]>([])
  const [nuevoTel, setNuevoTel] = useState('')
  const [loading, setLoading] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(concesionario.id ?? null)

  // ── Autocomplete state ──────────────────────────────────────────────────
  const [sugerencias, setSugerencias] = useState<LocalidadSugerencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [geocodificado, setGeocodificado] = useState(
    !!(concesionario.latitud && concesionario.longitud)
  )
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // ── Telefonos ──────────────────────────────────────────────────────────
  const fetchTelefonos = useCallback(async (targetId?: string) => {
    const id = targetId ?? createdId
    if (!id) return
    const { data } = await supabase
      .from('concesionario_telefonos')
      .select('*')
      .eq('concesionario_id', id)
    setTelefonos(data || [])
  }, [createdId])

  useEffect(() => {
    if (createdId) fetchTelefonos()
  }, [createdId, fetchTelefonos])

  // ── City autocomplete ──────────────────────────────────────────────────
  const handleCiudadChange = (val: string) => {
    setCiudad(val)
    setGeocodificado(false)
    setSugerencias([])

    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (val.trim().length < 2) { setBuscando(false); return }

    setBuscando(true)
    debounceRef.current = setTimeout(async () => {
      const results = await buscarLocalidades(val, 6)
      setSugerencias(results)
      setBuscando(false)
    }, 400)
  }

  const seleccionarLocalidad = (sug: LocalidadSugerencia) => {
    setCiudad(sug.nombre)
    setProvincia(sug.provincia)
    setLatitud(sug.lat)
    setLongitud(sug.lon)
    setGeocodificado(true)
    setSugerencias([])
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSugerencias([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Save ────────────────────────────────────────────────────────────────
  const handleUpdateBase = async () => {
    if (!nombre.trim()) {
      alert('EL NOMBRE (RAZÓN SOCIAL) ES OBLIGATORIO')
      return
    }
    if (!telefonoPrincipal.trim()) {
      alert('EL TELÉFONO PRINCIPAL ES OBLIGATORIO')
      return
    }

    setLoading(true)
    try {
      if (isNuevo) {
        // INSERT new concesionario
        const { data, error } = await supabase
          .from('concesionarios')
          .insert({
            nombre: nombre.toUpperCase(),
            localidad: localidad.toUpperCase() || null,
            telefono_principal: telefonoPrincipal.trim(),
            ciudad: ciudad || null,
            provincia: provincia || null,
            latitud: latitud ?? null,
            longitud: longitud ?? null,
          })
          .select('id')
          .single()

        if (error) throw error
        setCreatedId(data.id)
        onSuccess()
        alert('CONCESIONARIO CREADO CORRECTAMENTE')
      } else {
        // UPDATE existing concesionario
        const { error } = await supabase
          .from('concesionarios')
          .update({
            nombre: nombre.toUpperCase(),
            localidad: localidad.toUpperCase() || null,
            telefono_principal: telefonoPrincipal.trim(),
            ciudad: ciudad || null,
            provincia: provincia || null,
            latitud: latitud ?? null,
            longitud: longitud ?? null,
          })
          .eq('id', concesionario.id)

        if (error) throw error
        onSuccess()
        alert('DATOS ACTUALIZADOS CORRECTAMENTE')
      }
    } catch (err: any) {
      console.error(err)
      const msg = err?.message?.includes('duplicate') || err?.message?.includes('unique')
        ? 'YA EXISTE UN CONCESIONARIO CON ESE TELÉFONO PRINCIPAL'
        : `ERROR: ${err?.message ?? 'Error desconocido'}`
      alert(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Telefonos CRUD ─────────────────────────────────────────────────────
  const addTelefono = async () => {
    if (!nuevoTel.trim()) return
    if (!createdId) {
      alert('PRIMERO GUARDA LOS DATOS PRINCIPALES DEL CONCESIONARIO')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase
        .from('concesionario_telefonos')
        .insert([{ concesionario_id: createdId, numero_telefono: nuevoTel.trim(), nombre_referencia: 'ADICIONAL' }])
      if (error) throw error
      setNuevoTel('')
      fetchTelefonos()
      onSuccess()
    } catch {
      alert('ESTE NÚMERO YA EXISTE EN OTRO CONCESIONARIO')
    } finally {
      setLoading(false)
    }
  }

  const deleteTelefono = async (id: string) => {
    if (!window.confirm('¿ELIMINAR ESTE NÚMERO DE LA AGENDA?')) return
    await supabase.from('concesionario_telefonos').delete().eq('id', id)
    fetchTelefonos()
    onSuccess()
  }

  // ─────────────────────────────────────────────────────────────────────────

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
              <h2 className="text-white font-black italic uppercase tracking-tighter text-2xl leading-none">
                {isNuevo ? 'Nuevo Concesionario' : 'Configuración de Terminal'}
              </h2>
              <p className="text-neutral-500 text-[9px] font-bold uppercase tracking-[0.3em] mt-2 italic">
                {isNuevo ? 'Completá todos los campos requeridos' : `ID: ${(createdId ?? concesionario.id)?.split('-')[0]}...`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-neutral-800 rounded-full text-neutral-400 hover:text-white transition-all">
            <X size={20} />
          </button>
        </div>

        <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">

          {/* COL IZQ: INFO PRINCIPAL */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-red-600">
              <Hash size={14} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Datos de Identidad</h3>
            </div>

            <div className="space-y-4">
              {/* Nombre */}
              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">
                  Razón Social <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                  <input
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase transition-all"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                  />
                </div>
              </div>

              {/* Teléfono Principal */}
              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">
                  Teléfono Principal <span className="text-red-600">*</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                  <input
                    placeholder="+54 9..."
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold font-mono focus:border-red-600 outline-none transition-all placeholder:text-neutral-800 placeholder:not-italic"
                    value={telefonoPrincipal}
                    onChange={(e) => setTelefonoPrincipal(e.target.value)}
                  />
                </div>
              </div>

              {/* Localidad (legacy) */}
              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">
                  Localidad (texto libre)
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                  <input
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase transition-all"
                    value={localidad}
                    onChange={(e) => setLocalidad(e.target.value)}
                  />
                </div>
              </div>

              {/* Ciudad con autocomplete georef */}
              <div className="group" ref={dropdownRef}>
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1 group-focus-within:text-red-500 transition-colors">
                  Ciudad (para el mapa)
                </label>
                <div className="relative">
                  {buscando ? (
                    <Loader2 className="absolute left-4 top-1/2 -translate-y-1/2 text-red-600 animate-spin" size={18} />
                  ) : geocodificado ? (
                    <CheckCircle className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" size={18} />
                  ) : (
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={18} />
                  )}
                  <input
                    placeholder="Ej: Rosario..."
                    className="w-full bg-black border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold italic focus:border-red-600 outline-none uppercase transition-all placeholder:normal-case placeholder:not-italic placeholder:text-neutral-700"
                    value={ciudad}
                    onChange={(e) => handleCiudadChange(e.target.value)}
                    autoComplete="off"
                  />

                  {/* Dropdown de sugerencias */}
                  {sugerencias.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden shadow-2xl">
                      {sugerencias.map((s, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => seleccionarLocalidad(s)}
                          className="w-full text-left px-5 py-3 hover:bg-red-600/20 transition-colors border-b border-neutral-800 last:border-0 flex items-center gap-3"
                        >
                          <MapPin size={14} className="text-red-600 shrink-0" />
                          <div>
                            <span className="text-white font-bold text-sm">{s.nombre}</span>
                            <span className="text-neutral-500 text-xs ml-2">{s.provincia}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Provincia (auto-filled) */}
              <div className="group">
                <label className="text-[9px] font-black text-neutral-600 uppercase mb-2 block ml-1">
                  Provincia (se llena automáticamente)
                </label>
                <div className="relative">
                  <input
                    readOnly
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-4 px-4 text-neutral-400 font-bold italic outline-none uppercase cursor-default"
                    value={provincia}
                    placeholder="Se completará al elegir ciudad"
                  />
                </div>
              </div>

              {/* Coordenadas display */}
              {latitud && longitud && (
                <div className="bg-black/40 border border-neutral-800 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle size={16} className="text-green-500 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-green-400 text-[10px] font-black uppercase tracking-widest">
                      Coordenadas verificadas
                    </span>
                    <span className="text-neutral-500 text-[9px] font-mono mt-0.5">
                      {latitud.toFixed(5)}°, {longitud.toFixed(5)}°
                    </span>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleUpdateBase}
              disabled={loading}
              className="w-full py-5 bg-white text-black font-black uppercase italic rounded-2xl hover:bg-red-600 hover:text-white transition-all text-xs tracking-widest shadow-xl active:scale-95 disabled:opacity-50"
            >
              <Save size={18} className="inline mr-2" />
              {loading ? 'Procesando...' : isNuevo && !createdId ? 'Crear Concesionario' : 'Guardar Cambios'}
            </button>
          </div>

          {/* COL DER: TERMINALES ASOCIADAS */}
          <div className="space-y-8 bg-black/30 p-8 rounded-[2rem] border border-neutral-800/50">
            <div className="flex items-center gap-2 text-red-600">
              <Phone size={14} />
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic">Números Vinculados</h3>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-2">
              {telefonos.length > 0 ? (
                telefonos.map((t) => (
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
                ))
              ) : (
                <p className="text-neutral-700 text-[10px] font-bold italic uppercase text-center py-10">
                  Sin números registrados
                </p>
              )}
            </div>

            <div className="pt-6 border-t border-neutral-800">
              <label className="text-[9px] font-black text-neutral-500 uppercase mb-3 block text-center italic tracking-widest">
                Agregar Nueva Línea
              </label>
              <div className="flex gap-2">
                <input
                  placeholder="+54 9..."
                  className="flex-1 bg-black border border-neutral-800 rounded-xl p-4 text-white font-mono text-sm focus:border-red-600 outline-none placeholder:text-neutral-800"
                  value={nuevoTel}
                  onChange={(e) => setNuevoTel(e.target.value)}
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
