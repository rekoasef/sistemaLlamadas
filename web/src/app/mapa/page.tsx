'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { MapPin, Wifi, ChevronLeft } from 'lucide-react'
import { fetchLlamadasWallboard, type RangoWallboard } from '@/services/llamadas.service'
import { supabase } from '@/lib/supabase'
import type { LlamadaConConcesionario } from '@/types/domain'
import {
  usePins,
  useCallsByProvince,
  callsToColor,
  type ConcesionarioPin,
} from '@/app/dashboard-planta/components/ArgentinaMap'

// ─────────────────────────────────────────────────────────────────────────────
// Dynamic imports — react-simple-maps must not render on the server
// ─────────────────────────────────────────────────────────────────────────────
const MapCanvas = dynamic(
  () => import('@/app/dashboard-planta/components/ArgentinaMap').then((m) => ({ default: m.MapCanvas })),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-neutral-600 text-xs font-black uppercase tracking-widest">Cargando mapa…</span>
        </div>
      </div>
    ),
  }
)

const RankingSidebar = dynamic(
  () => import('@/app/dashboard-planta/components/ArgentinaMap').then((m) => ({ default: m.RankingSidebar })),
  { ssr: false }
)

// ─────────────────────────────────────────────────────────────────────────────
// Rango options
// ─────────────────────────────────────────────────────────────────────────────
const RANGOS: { key: RangoWallboard; label: string }[] = [
  { key: 'HOY',       label: 'HOY' },
  { key: '7D',        label: '7 DÍAS' },
  { key: '30D',       label: '30 DÍAS' },
  { key: 'HISTORICO', label: 'HISTÓRICO' },
]
const LS_KEY = 'mapa-rango'

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────
export default function MapaPage() {
  const [rango, setRangoState] = useState<RangoWallboard>('HOY')
  const [llamadas, setLlamadas] = useState<LlamadaConConcesionario[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [pulse, setPulse] = useState(false)
  const [hoveredPin, setHoveredPin] = useState<ConcesionarioPin | null>(null)

  const cargarDatosRef = useRef<() => Promise<void>>(() => Promise.resolve())

  // Hydrate rango from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as RangoWallboard | null
    if (saved && RANGOS.some((r) => r.key === saved)) setRangoState(saved)
  }, [])

  const setRango = useCallback((r: RangoWallboard) => {
    setRangoState(r)
    localStorage.setItem(LS_KEY, r)
  }, [])

  const cargarDatos = useCallback(async () => {
    try {
      const rows = await fetchLlamadasWallboard(rango)
      setLlamadas(rows)
      setLastUpdate(new Date())
      setPulse(true)
      setTimeout(() => setPulse(false), 800)
    } catch (err) {
      console.error('[MapaPage] cargarDatos:', err)
    } finally {
      setLoading(false)
    }
  }, [rango])

  useEffect(() => { cargarDatosRef.current = cargarDatos }, [cargarDatos])

  // Initial load + re-load on rango change
  useEffect(() => {
    setLoading(true)
    cargarDatos()
  }, [cargarDatos])

  // Realtime updates
  useEffect(() => {
    const channel = supabase
      .channel('mapa-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, () => {
        void cargarDatosRef.current()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  // ── Derived data ────────────────────────────────────────────────────────
  const pins = usePins(llamadas)
  const callsByProvince = useCallsByProvince(llamadas)
  const maxCalls = useMemo(() => Math.max(...Object.values(callsByProvince), 1), [callsByProvince])
  const maxPinCalls = useMemo(() => Math.max(...pins.map((p) => p.total), 1), [pins])

  const handleHoverPin = useCallback((pin: ConcesionarioPin | null) => setHoveredPin(pin), [])

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="h-screen overflow-hidden bg-[#0F0F0F] text-white flex flex-col select-none">

      {/* HEADER */}
      <header className="shrink-0 flex items-center justify-between px-10 py-4 border-b border-neutral-800 bg-black/60">
        {/* Back + Title */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard-planta"
            className="flex items-center gap-2 text-neutral-500 hover:text-red-600 transition-colors group"
          >
            <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Wallboard</span>
          </Link>
          <div className="w-px h-8 bg-neutral-800" />
          <div className="flex items-center gap-4">
            <div className="p-2 bg-red-600 rounded-xl shadow-[0_0_16px_rgba(220,38,38,0.4)]">
              <MapPin size={18} className="text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-2xl font-black italic uppercase tracking-tighter text-white">
                Mapa de <span className="text-red-600">Actividad</span>
              </span>
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500 mt-1">
                Distribución geográfica de llamadas
              </span>
            </div>
          </div>
        </div>

        {/* Rango tabs */}
        <div className="flex items-center gap-1 border border-neutral-800 rounded-xl p-1 bg-neutral-900/70">
          {RANGOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRango(key)}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                rango === key
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live badge */}
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full bg-red-600 transition-all duration-300 ${pulse ? 'scale-150 opacity-100' : 'opacity-70 animate-pulse'}`} />
          <span className="text-red-600 text-xs font-black uppercase tracking-widest italic">LIVE</span>
          {lastUpdate && (
            <span suppressHydrationWarning className="text-neutral-600 text-[10px] font-bold uppercase tracking-widest">
              Act. {lastUpdate.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <div className="ml-2 flex flex-col items-end leading-none">
            <span className="text-white font-black italic text-lg tracking-tight">
              {loading ? '—' : pins.length}
            </span>
            <span className="text-neutral-600 text-[8px] font-black uppercase">sucursales</span>
          </div>
          <div className="flex flex-col items-end leading-none">
            <span className="text-white font-black italic text-lg tracking-tight">
              {loading ? '—' : llamadas.length}
            </span>
            <span className="text-neutral-600 text-[8px] font-black uppercase">llamadas</span>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="flex-1 flex min-h-0">

        {/* Map area */}
        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <Wifi size={32} className="text-red-600 animate-pulse" />
                <span className="text-neutral-600 text-xs font-black uppercase tracking-widest">Cargando datos…</span>
              </div>
            </div>
          ) : (
            <MapCanvas
              pins={pins}
              callsByProvince={callsByProvince}
              maxCalls={maxCalls}
              maxPinCalls={maxPinCalls}
              variant="full"
              hoveredPin={hoveredPin}
              onHoverPin={handleHoverPin}
            />
          )}

          {/* Tooltip on hover */}
          {hoveredPin && (
            <div className="pointer-events-none absolute bottom-8 left-8 z-20 bg-neutral-900 border border-neutral-700 rounded-2xl p-5 shadow-2xl min-w-[200px] animate-in fade-in duration-100">
              <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest mb-1">
                {hoveredPin.ciudad}{hoveredPin.provincia ? `, ${hoveredPin.provincia}` : ''}
              </p>
              <p className="text-white font-black italic uppercase text-lg leading-tight tracking-tight mb-4">
                {hoveredPin.nombre}
              </p>
              <div className="flex gap-6">
                <div className="flex flex-col">
                  <span className="text-white font-black text-3xl italic tracking-tighter leading-none">
                    {hoveredPin.total}
                  </span>
                  <span className="text-neutral-600 text-[8px] font-black uppercase mt-1">Llamadas</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-green-400 font-black text-3xl italic tracking-tighter leading-none">
                    {hoveredPin.total > 0 ? Math.round((hoveredPin.atendidas / hoveredPin.total) * 100) : 0}%
                  </span>
                  <span className="text-neutral-600 text-[8px] font-black uppercase mt-1">Eficiencia</span>
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-8 right-8 bg-neutral-900/90 border border-neutral-800 rounded-2xl p-5 backdrop-blur-sm">
            <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest mb-3">
              Volumen de llamadas
            </p>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-neutral-600 text-[8px] font-black">Bajo</span>
              <div className="flex-1 h-2 rounded-full w-24"
                style={{ background: 'linear-gradient(to right, #ffffb2, #fd8d3c, #bd0026)' }} />
              <span className="text-neutral-600 text-[8px] font-black">Alto</span>
            </div>
            <div className="flex items-center gap-3">
              <svg width="50" height="16">
                <circle cx="6"  cy="8" r="3" fill="#fd8d3c" opacity="0.8" />
                <circle cx="20" cy="8" r="6" fill="#fd8d3c" opacity="0.8" />
                <circle cx="38" cy="8" r="9" fill="#fd8d3c" opacity="0.8" />
              </svg>
              <span className="text-neutral-600 text-[8px] font-black uppercase">Tamaño = llamadas</span>
            </div>
          </div>
        </div>

        {/* Ranking sidebar */}
        <RankingSidebar
          pins={pins}
          maxPinCalls={maxPinCalls}
          hoveredPin={hoveredPin}
          onHoverPin={handleHoverPin}
        />
      </div>
    </div>
  )
}
