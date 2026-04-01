'use client'

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import {
  Wifi, Monitor, TrendingUp, PhoneIncoming, PhoneOutgoing, Activity, MapPin,
} from 'lucide-react'
import Link from 'next/link'
import { fetchLlamadasWallboard, fetchLlamadasHoy, type RangoWallboard } from '@/services/llamadas.service'
import { fetchAliasMap } from '@/services/alias.service'
import { calcularKPIs } from '@/lib/kpi'
import {
  calcularEficienciaFranjas,
  calcularRankingTerminales,
  calcularTopConcesionarios,
  type FranjaEficiencia,
  type TerminalRanking,
  type ConcesionarioRanking,
} from '@/lib/wallboard'
import { supabase } from '@/lib/supabase'
import type { LlamadaConConcesionario, AliasMap, KPIStats } from '@/types/domain'
import {
  MapCanvas,
  usePins,
  useCallsByProvince,
} from '@/app/dashboard-planta/components/ArgentinaMap'

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 15_000
const LS_KEY = 'wallboard-rango'

const RANGOS: { key: RangoWallboard; label: string }[] = [
  { key: 'HOY',      label: 'HOY' },
  { key: '7D',       label: '7 DÍAS' },
  { key: '30D',      label: '30 DÍAS' },
  { key: 'HISTORICO', label: 'HISTÓRICO' },
]

const RANGO_LABEL: Record<RangoWallboard, string> = {
  HOY:       'Total del día',
  '7D':      'Total 7 días',
  '30D':     'Total 30 días',
  HISTORICO: 'Total histórico',
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS animation
// ─────────────────────────────────────────────────────────────────────────────

const FLASH_CSS = `
@keyframes wbFlash {
  0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
  20%  { box-shadow: 0 0 28px 6px rgba(220,38,38,0.65); }
  60%  { box-shadow: 0 0 14px 3px rgba(255,255,255,0.15); }
  100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
}
.wb-flash { animation: wbFlash 0.75s ease-out forwards; }
.wb-scroll::-webkit-scrollbar { width: 4px; }
.wb-scroll::-webkit-scrollbar-track { background: transparent; }
.wb-scroll::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
.wb-scroll::-webkit-scrollbar-thumb:hover { background: #444; }
`

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function WallboardClock() {
  const [now, setNow] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex flex-col items-end leading-none">
      <span
        suppressHydrationWarning
        className="text-3xl md:text-5xl font-black italic tracking-tighter text-white"
      >
        {mounted ? now.toLocaleTimeString('es-AR', { hour12: false }) : '--:--:--'}
      </span>
      <span
        suppressHydrationWarning
        className="text-[9px] font-black uppercase tracking-widest text-neutral-500 mt-1"
      >
        {mounted
          ? now.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
          : '--- -- de ------- de ----'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string
  value: string | number
  valueColor: string
  icon: React.ReactNode
  progress?: number
  progressColor?: string
  flashKey: number
  /** Value for the current day (shown as subtitle when range ≠ HOY) */
  todayValue?: string | number
  rango: RangoWallboard
  /** Optional secondary footnote text shown at the bottom of the card */
  footnote?: string
}

const KpiCard = memo(function KpiCard({
  label, value, valueColor, icon, progress, progressColor = 'bg-red-600',
  flashKey, todayValue, rango, footnote,
}: KpiCardProps) {
  const [flashing, setFlashing] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flashKey === 0) return
    setFlashing(false)
    void divRef.current?.offsetWidth
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 800)
    return () => clearTimeout(t)
  }, [flashKey])

  const showToday = rango !== 'HOY' && todayValue !== undefined

  return (
    <div
      ref={divRef}
      className={`flex-1 bg-neutral-900 border border-white/10 rounded-xl flex flex-col gap-2 min-w-0 transition-colors duration-300 ${flashing ? 'wb-flash' : ''}`}
      style={{ padding: '20px' }}
    >
      {/* Top row: label (left) + icon (right) */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-widest text-neutral-500">{label}</span>
        <span className="text-neutral-700 shrink-0">{icon}</span>
      </div>

      {/* Main value — large focal point */}
      <span className={`text-[2.8rem] font-black italic tracking-tighter leading-none ${valueColor}`}>
        {value}
      </span>

      {/* Subtexts: today + footnote */}
      <div className="flex flex-col gap-0.5 mt-auto">
        {showToday && (
          <div className="flex items-center gap-1.5">
            <span className="text-[7px] font-black uppercase tracking-widest text-neutral-700">HOY</span>
            <span className={`text-sm font-black italic tracking-tight leading-none ${valueColor} opacity-60`}>
              {todayValue}
            </span>
          </div>
        )}
        {footnote && (
          <span className="text-[8px] font-black uppercase tracking-widest text-neutral-600">{footnote}</span>
        )}
      </div>

      {/* Progress bar */}
      {progress !== undefined && (
        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-1000 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────

interface FranjaRowProps {
  franja: FranjaEficiencia
  maxTotal: number
}

const FranjaRow = memo(function FranjaRow({ franja, maxTotal }: FranjaRowProps) {
  const colorClass =
    franja.eficiencia >= 80 ? 'text-green-400' : franja.eficiencia >= 60 ? 'text-yellow-400' : 'text-red-500'
  const barColorClass =
    franja.eficiencia >= 80 ? 'bg-green-500' : franja.eficiencia >= 60 ? 'bg-yellow-500' : 'bg-red-600'
  const barWidth = maxTotal > 0 ? Math.round((franja.total / maxTotal) * 100) : 0

  return (
    <div className="flex flex-col gap-1.5 py-3 border-b border-neutral-800/50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-xs font-black uppercase tracking-widest italic">
          {franja.label}
        </span>
        <div className="flex items-center gap-4">
          <span className="text-neutral-500 text-[9px] font-bold font-mono">
            {franja.atendidas}/{franja.total}
          </span>
          <span className={`text-xl font-black italic tracking-tighter w-14 text-right ${colorClass}`}>
            {franja.total > 0 ? `${franja.eficiencia}%` : '--'}
          </span>
        </div>
      </div>
      <div
        className="relative h-2 bg-neutral-800/80 rounded-full overflow-hidden"
        style={{ width: `${barWidth}%`, minWidth: '10%' }}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${barColorClass} opacity-90`}
          style={{ width: `${franja.eficiencia}%` }}
        />
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────

interface TerminalRowProps {
  terminal: TerminalRanking
  rank: number
  flashKey: number
}

const TerminalRow = memo(function TerminalRow({ terminal, rank, flashKey }: TerminalRowProps) {
  const eficienciaColor =
    terminal.eficiencia >= 80 ? 'text-green-400' : terminal.eficiencia >= 60 ? 'text-yellow-400' : 'text-red-500'
  const barColor =
    terminal.eficiencia >= 80 ? 'bg-green-500' : terminal.eficiencia >= 60 ? 'bg-yellow-500' : 'bg-red-600'

  const [flashing, setFlashing] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flashKey === 0) return
    setFlashing(false)
    void rowRef.current?.offsetWidth
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 800)
    return () => clearTimeout(t)
  }, [flashKey])

  return (
    <div
      ref={rowRef}
      className={`flex flex-col gap-1 py-2.5 border-b border-neutral-800/40 last:border-0 rounded-xl px-2 -mx-2 ${flashing ? 'wb-flash' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span className="text-neutral-700 text-[9px] font-black w-4 text-right shrink-0">{rank}</span>
        <div className="flex-1 min-w-0">
          <span className="text-white font-black italic uppercase tracking-tight text-sm truncate block">
            {terminal.alias}
          </span>
        </div>
        <span className="text-white font-black italic text-base w-7 text-right shrink-0">{terminal.total}</span>
        <span className={`text-[10px] font-black italic w-9 text-right shrink-0 ${eficienciaColor}`}>
          {terminal.eficiencia}%
        </span>
      </div>
      <div className="ml-7 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${barColor}`}
          style={{ width: `${terminal.eficiencia}%` }}
        />
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────

interface ConcesionarioRowProps {
  item: ConcesionarioRanking
  rank: number
  maxTotal: number
  flashKey: number
}

const ConcesionarioRow = memo(function ConcesionarioRow({
  item, rank, maxTotal, flashKey,
}: ConcesionarioRowProps) {
  const barWidth = maxTotal > 0 ? Math.round((item.total / maxTotal) * 100) : 0
  const isTop3 = rank <= 3

  const [flashing, setFlashing] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flashKey === 0) return
    setFlashing(false)
    void rowRef.current?.offsetWidth
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 800)
    return () => clearTimeout(t)
  }, [flashKey])

  return (
    <div
      ref={rowRef}
      className={`flex items-center gap-2.5 py-2 border-b border-neutral-800/40 last:border-0 rounded-xl px-1 -mx-1 ${flashing ? 'wb-flash' : ''}`}
    >
      <span className={`text-[9px] font-black w-4 text-right shrink-0 ${isTop3 ? 'text-red-500' : 'text-neutral-700'}`}>
        {rank}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className="text-white font-bold uppercase text-[10px] tracking-wide truncate">
          {item.nombre}
        </span>
        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isTop3 ? 'bg-red-600' : 'bg-neutral-600'} transition-all duration-1000`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span className="text-white font-black italic text-base w-7 text-right shrink-0">{item.total}</span>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Dashboard Planta — Wallboard view for call center TVs.
 *
 * v3.1 — Dual metric KPI cards (periodo + hoy), embedded Argentina map,
 *         4-column main layout, logo linked to home, responsive mobile support.
 */
export default function DashboardPlantaPage() {
  const [rango, setRangoState] = useState<RangoWallboard>('HOY')
  const [llamadas, setLlamadasRaw] = useState<LlamadaConConcesionario[]>([])
  const [llamadasHoy, setLlamadasHoy] = useState<LlamadaConConcesionario[]>([])
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [pulse, setPulse] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const [hoveredPin, setHoveredPin] = useState<import('@/app/dashboard-planta/components/ArgentinaMap').ConcesionarioPin | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as RangoWallboard | null
    if (saved && RANGOS.some((r) => r.key === saved)) setRangoState(saved)
  }, [])

  const setRango = useCallback((r: RangoWallboard) => {
    setRangoState(r)
    localStorage.setItem(LS_KEY, r)
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    try {
      const [rows, hoy, aliases] = await Promise.all([
        fetchLlamadasWallboard(rango),
        rango === 'HOY' ? Promise.resolve(null) : fetchLlamadasHoy(),
        fetchAliasMap(),
      ])
      setLlamadasRaw(rows)
      setLlamadasHoy(rango === 'HOY' ? rows : (hoy ?? []))
      setAliasMap(aliases)
      setLastUpdate(new Date())
      setPulse(true)
      setFlashKey((k) => k + 1)
      setTimeout(() => setPulse(false), 800)
    } catch (err) {
      console.error('[DashboardPlantaPage] cargarDatos:', err)
    } finally {
      setLoading(false)
    }
  }, [rango])

  const cargarDatosRef = useRef(cargarDatos)
  useEffect(() => { cargarDatosRef.current = cargarDatos }, [cargarDatos])

  useEffect(() => {
    cargarDatos()
    intervalRef.current = setInterval(cargarDatos, REFRESH_INTERVAL_MS)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [cargarDatos])

  useEffect(() => {
    const channel = supabase
      .channel('wallboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'llamadas' }, () => {
        void cargarDatosRef.current()
      })
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  // ── Derived data ──────────────────────────────────────────────────────────

  const kpis: KPIStats = useMemo(() => calcularKPIs(llamadas), [llamadas])
  const kpisHoy: KPIStats = useMemo(() => calcularKPIs(llamadasHoy), [llamadasHoy])

  const franjas: FranjaEficiencia[] = useMemo(() => calcularEficienciaFranjas(llamadas), [llamadas])
  const maxFranjaTotal = useMemo(() => Math.max(...franjas.map((f) => f.total), 1), [franjas])

  const terminales: TerminalRanking[] = useMemo(
    () => calcularRankingTerminales(llamadas, aliasMap),
    [llamadas, aliasMap]
  )

  const topConces: ConcesionarioRanking[] = useMemo(
    () => calcularTopConcesionarios(llamadas, 10),
    [llamadas]
  )
  const maxConcesTotal = useMemo(() => Math.max(...topConces.map((c) => c.total), 1), [topConces])

  // Map data
  const pins = usePins(llamadas)
  const callsByProvince = useCallsByProvince(llamadas)
  const maxPinCalls = useMemo(() => Math.max(...pins.map((p) => p.total), 1), [pins])
  const maxProvinceCalls = useMemo(() => Math.max(...Object.values(callsByProvince), 1), [callsByProvince])

  const eficienciaColor =
    kpis.eficiencia >= 80 ? 'text-green-400' : kpis.eficiencia >= 60 ? 'text-yellow-400' : 'text-red-500'
  const eficienciaBarColor =
    kpis.eficiencia >= 80 ? 'bg-green-500' : kpis.eficiencia >= 60 ? 'bg-yellow-500' : 'bg-red-600'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen md:h-screen md:overflow-hidden bg-[#0F0F0F] text-white flex flex-col select-none"
      style={{ fontFamily: 'inherit' }}
    >
      <style>{FLASH_CSS}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 md:px-10 py-3 border-b border-neutral-800 bg-black/60">
        {/* Logo → home */}
        <Link href="/" className="flex items-center gap-4 group">
          <div className="bg-red-600 px-2.5 py-1.5 rounded-xl text-white font-black italic text-lg shadow-[0_0_20px_rgba(220,38,38,0.5)] group-hover:bg-red-500 transition-colors">
            CT
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-2xl font-black italic uppercase tracking-tighter text-white group-hover:text-red-400 transition-colors">
              CRUCI <span className="text-red-600">TRACK</span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-neutral-500 mt-0.5">
              Call Center Wallboard
            </span>
          </div>
        </Link>

        {/* Rango tabs */}
        <div className="flex items-center gap-1 border border-neutral-800 rounded-xl p-1 bg-neutral-900/70">
          {RANGOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRango(key)}
              className={`
                px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest
                transition-all duration-200
                ${rango === key
                  ? 'bg-red-600 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'}
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Live badge + Clock */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full bg-red-600 transition-all duration-300 ${pulse ? 'scale-150 opacity-100' : 'opacity-70 animate-pulse'}`}
            />
            <span className="text-red-600 text-[9px] font-black uppercase tracking-widest italic">LIVE</span>
            {lastUpdate && (
              <span suppressHydrationWarning className="text-neutral-700 text-[9px] font-bold uppercase tracking-widest hidden sm:block">
                Act. {lastUpdate.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <WallboardClock />
        </div>
      </header>

      {/* ── BODY: two main columns ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 p-4 min-h-0 overflow-y-auto md:overflow-hidden">

        {/* ════════════════════════════════════════════════════════════════
            COLUMNA IZQUIERDA (60%): 3 KPI cards + 3 secciones inferiores
        ════════════════════════════════════════════════════════════════ */}
        <div className="flex-[3] min-w-0 flex flex-col gap-4">

          {/* ── 3 KPI Cards ───────────────────────────────────────────── */}
          <div className="shrink-0 flex gap-4">
            <KpiCard
              label="Entrantes"
              value={loading ? '—' : kpis.entrantes}
              valueColor="text-blue-400"
              icon={<PhoneIncoming size={16} />}
              flashKey={flashKey}
              todayValue={loading ? '—' : kpisHoy.entrantes}
              rango={rango}
            />
            <KpiCard
              label="Salientes"
              value={loading ? '—' : kpis.salientes}
              valueColor="text-purple-400"
              icon={<PhoneOutgoing size={16} />}
              flashKey={flashKey}
              todayValue={loading ? '—' : kpisHoy.salientes}
              rango={rango}
            />
            <KpiCard
              label="Eficiencia General"
              value={loading ? '—' : `${kpis.eficiencia}%`}
              valueColor={eficienciaColor}
              icon={<TrendingUp size={16} />}
              progress={loading ? 0 : kpis.eficiencia}
              progressColor={eficienciaBarColor}
              flashKey={flashKey}
              todayValue={loading ? '—' : `${kpisHoy.eficiencia}%`}
              rango={rango}
              footnote={loading ? undefined : `Total: ${kpis.total} llamadas`}
            />
          </div>

          {/* ── Fila inferior: Terminales + Franjas + Top 10 ──────────── */}
          <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">

            {/* ── Terminales ────────────────────────────────────────── */}
            <div className="flex-1 bg-neutral-900 border border-white/10 rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-white/10 shrink-0 flex items-center gap-2">
                <Monitor size={13} className="text-red-600" />
                <span className="text-[10px] font-black uppercase tracking-widest italic text-white">Terminales</span>
              </div>
              <div className="flex items-center gap-3 px-4 py-1 shrink-0">
                <span className="text-neutral-700 text-[8px] font-black uppercase w-4 text-right shrink-0">#</span>
                <span className="flex-1 text-neutral-600 text-[8px] font-black uppercase">Terminal</span>
                <span className="text-neutral-600 text-[8px] font-black uppercase w-7 text-right shrink-0">Tot</span>
                <span className="text-neutral-600 text-[8px] font-black uppercase w-9 text-right shrink-0">Efic.</span>
              </div>
              <div className="flex-1 overflow-y-auto wb-scroll px-4 pb-3">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Wifi size={18} className="text-red-600 animate-pulse" />
                  </div>
                ) : terminales.length === 0 ? (
                  <p className="text-neutral-700 text-[10px] font-black uppercase italic text-center mt-8">Sin actividad</p>
                ) : (
                  terminales.map((t, i) => (
                    <TerminalRow key={t.id} terminal={t} rank={i + 1} flashKey={flashKey} />
                  ))
                )}
              </div>
            </div>

            {/* ── Franjas Horarias ──────────────────────────────────── */}
            <div className="flex-1 bg-neutral-900 border border-white/10 rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-white/10 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity size={13} className="text-red-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest italic text-white">Franjas Horarias</span>
                </div>
                <span className="text-neutral-600 text-[8px] font-black uppercase tracking-widest italic">07–19 hs</span>
              </div>
              <div className="flex-1 flex flex-col justify-around px-4 py-2 overflow-y-auto wb-scroll">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Wifi size={22} className="text-red-600 animate-pulse" />
                  </div>
                ) : (
                  franjas.map((f) => (
                    <FranjaRow key={f.label} franja={f} maxTotal={maxFranjaTotal} />
                  ))
                )}
              </div>
              {!loading && (
                <div className="px-4 py-2 border-t border-white/10 shrink-0 flex items-center justify-between bg-black/30">
                  <span className="text-neutral-600 text-[8px] font-black uppercase tracking-widest italic">
                    {RANGO_LABEL[rango]}:
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-white text-sm font-black italic">
                      {kpis.atendidas}
                      <span className="text-neutral-600 text-[9px] ml-1">at.</span>
                    </span>
                    <span className="text-neutral-400 text-xs">/</span>
                    <span className="text-white text-sm font-black italic">
                      {kpis.total}
                      <span className="text-neutral-600 text-[9px] ml-1">tot.</span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Top 10 Concesionarios ─────────────────────────────── */}
            <div className="flex-1 bg-neutral-900 border border-white/10 rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 pt-3 pb-2 border-b border-white/10 shrink-0 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={13} className="text-red-600" />
                  <span className="text-[10px] font-black uppercase tracking-widest italic text-white">Top 10</span>
                </div>
                <span className="text-neutral-600 text-[8px] font-black uppercase tracking-widest italic">
                  {RANGOS.find((r) => r.key === rango)?.label}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto wb-scroll px-4 py-2">
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <Wifi size={18} className="text-red-600 animate-pulse" />
                  </div>
                ) : topConces.length === 0 ? (
                  <p className="text-neutral-700 text-[10px] font-black uppercase italic text-center mt-8">
                    Sin llamadas entrantes
                  </p>
                ) : (
                  topConces.map((c, i) => (
                    <ConcesionarioRow
                      key={c.nombre}
                      item={c}
                      rank={i + 1}
                      maxTotal={maxConcesTotal}
                      flashKey={flashKey}
                    />
                  ))
                )}
              </div>
            </div>

          </div>{/* fin fila inferior */}
        </div>{/* fin columna izquierda */}

        {/* ════════════════════════════════════════════════════════════════
            COLUMNA DERECHA (40%): Mapa protagonista — alto completo
        ════════════════════════════════════════════════════════════════ */}
        <div className="md:w-[40%] shrink-0 bg-neutral-900 border border-white/10 rounded-xl flex flex-col overflow-hidden">

          {/* Header del mapa */}
          <div className="px-4 pt-3 pb-2 border-b border-white/10 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin size={13} className="text-red-600" />
              <span className="text-[10px] font-black uppercase tracking-widest italic text-white">
                Actividad por Zona
              </span>
            </div>
            <Link
              href="/mapa"
              className="text-[8px] font-black uppercase tracking-widest text-neutral-600 hover:text-red-500 transition-colors"
            >
              VER COMPLETO →
            </Link>
          </div>

          {/* Mapa — ocupa todo el alto restante, tooltip absoluto sin layout shift */}
          <div className="flex-1 min-h-0 relative">
            {/* Tooltip flotante — absolute para no desplazar el mapa */}
            {hoveredPin && (
              <div className="absolute top-3 left-3 right-3 z-50 bg-black/85 border border-white/10 rounded-xl px-3 py-2 pointer-events-none backdrop-blur-sm">
                <p className="text-white font-black text-xs truncate">{hoveredPin.nombre}</p>
                <p className="text-neutral-500 text-[9px] mt-0.5">
                  {hoveredPin.ciudad} · {hoveredPin.provincia}
                  <span className="ml-3 text-red-400 font-black">{hoveredPin.total} llamadas</span>
                </p>
              </div>
            )}
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Wifi size={22} className="text-red-600 animate-pulse" />
              </div>
            ) : (
              <MapCanvas
                pins={pins}
                callsByProvince={callsByProvince}
                maxCalls={maxProvinceCalls}
                maxPinCalls={maxPinCalls}
                variant="full"
                hoveredPin={hoveredPin}
                onHoverPin={setHoveredPin}
                mapScale={1050}
                mapCenter={[-65, -37]}
              />
            )}
          </div>

          {/* Leyenda */}
          <div className="px-4 py-2.5 border-t border-white/10 shrink-0 flex items-center justify-between bg-black/30">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-neutral-500 text-[8px] font-black uppercase tracking-widest">
                {pins.length} concesionarios activos
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-14 h-1.5 rounded-full" style={{ background: 'linear-gradient(to right, #ffffb2, #fd8d3c, #bd0026)' }} />
              <span className="text-neutral-700 text-[7px] font-black uppercase">actividad</span>
            </div>
          </div>

        </div>{/* fin columna derecha */}

      </div>{/* fin body */}
    </div>
  )
}
