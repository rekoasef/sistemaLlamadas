'use client'

import { useEffect, useState, useCallback, useMemo, useRef, memo } from 'react'
import { Wifi, Monitor, TrendingUp, PhoneIncoming, PhoneMissed, Activity, Map } from 'lucide-react'
import { fetchLlamadasWallboard, type RangoWallboard } from '@/services/llamadas.service'
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
import Link from 'next/link'

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
// Flash keyframe — injected once as a <style> inside the page render.
// ─────────────────────────────────────────────────────────────────────────────

const FLASH_CSS = `
@keyframes wbFlash {
  0%   { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
  20%  { box-shadow: 0 0 28px 6px rgba(220,38,38,0.65); }
  60%  { box-shadow: 0 0 14px 3px rgba(255,255,255,0.15); }
  100% { box-shadow: 0 0 0 0 rgba(220,38,38,0); }
}
.wb-flash { animation: wbFlash 0.75s ease-out forwards; }
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
        className="text-5xl font-black italic tracking-tighter text-white"
      >
        {mounted ? now.toLocaleTimeString('es-AR', { hour12: false }) : '--:--:--'}
      </span>
      <span
        suppressHydrationWarning
        className="text-sm font-black uppercase tracking-widest text-neutral-500 mt-1"
      >
        {mounted
          ? now.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
          : '--- -- de ------- de ----'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface KpiHeroProps {
  label: string
  value: string | number
  sub?: string
  valueColor: string
  icon: React.ReactNode
  progress?: number
  progressColor?: string
  flashKey: number
}

const KpiHero = memo(function KpiHero({
  label, value, sub, valueColor, icon, progress, progressColor = 'bg-red-600', flashKey,
}: KpiHeroProps) {
  const [flashing, setFlashing] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (flashKey === 0) return
    setFlashing(false)
    // Force reflow so animation restarts every time flashKey changes
    void divRef.current?.offsetWidth
    setFlashing(true)
    const t = setTimeout(() => setFlashing(false), 800)
    return () => clearTimeout(t)
  }, [flashKey])

  return (
    <div
      ref={divRef}
      className={`flex-1 bg-neutral-900/60 border border-neutral-800 rounded-3xl px-8 py-6 flex flex-col justify-between min-w-0 transition-colors duration-300 ${flashing ? 'wb-flash' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-neutral-500 text-xs font-black uppercase tracking-widest italic leading-none">
          {label}
        </span>
        <span className="text-neutral-700">{icon}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className={`text-7xl font-black italic tracking-tighter leading-none ${valueColor}`}>
          {value}
        </span>
        {sub && (
          <span className="text-neutral-600 text-xs font-black uppercase italic tracking-widest">
            {sub}
          </span>
        )}
      </div>
      {progress !== undefined && (
        <div className="mt-4 h-2 bg-neutral-800 rounded-full overflow-hidden">
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
    franja.eficiencia >= 80
      ? 'text-green-400'
      : franja.eficiencia >= 60
      ? 'text-yellow-400'
      : 'text-red-500'

  const barColorClass =
    franja.eficiencia >= 80
      ? 'bg-green-500'
      : franja.eficiencia >= 60
      ? 'bg-yellow-500'
      : 'bg-red-600'

  const barWidth = maxTotal > 0 ? Math.round((franja.total / maxTotal) * 100) : 0
  const barFill = franja.total > 0 ? franja.eficiencia : 0

  return (
    <div className="flex flex-col gap-2 py-4 border-b border-neutral-800/50 last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-neutral-400 text-sm font-black uppercase tracking-widest italic">
          {franja.label}
        </span>
        <div className="flex items-center gap-6">
          <span className="text-neutral-500 text-xs font-bold font-mono">
            {franja.atendidas}/{franja.total} LLAMADAS
          </span>
          <span className={`text-2xl font-black italic tracking-tighter w-16 text-right ${colorClass}`}>
            {franja.total > 0 ? `${franja.eficiencia}%` : '--'}
          </span>
        </div>
      </div>
      <div
        className="relative h-3 bg-neutral-800/80 rounded-full overflow-hidden"
        style={{ width: `${barWidth}%`, minWidth: '10%' }}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ${barColorClass} opacity-90`}
          style={{ width: `${barFill}%` }}
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
    terminal.eficiencia >= 80
      ? 'text-green-400'
      : terminal.eficiencia >= 60
      ? 'text-yellow-400'
      : 'text-red-500'

  const barColor =
    terminal.eficiencia >= 80
      ? 'bg-green-500'
      : terminal.eficiencia >= 60
      ? 'bg-yellow-500'
      : 'bg-red-600'

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
      className={`flex flex-col gap-1 py-3 border-b border-neutral-800/40 last:border-0 rounded-xl px-2 -mx-2 ${flashing ? 'wb-flash' : ''}`}
    >
      <div className="flex items-center gap-4">
        <span className="text-neutral-700 text-xs font-black w-5 text-right shrink-0">{rank}</span>
        <div className="flex-1 min-w-0">
          <span className="text-white font-black italic uppercase tracking-tight text-base truncate block">
            {terminal.alias}
          </span>
        </div>
        <span className="text-white font-black italic text-xl w-8 text-right shrink-0">
          {terminal.total}
        </span>
        <span className={`text-xs font-black italic w-10 text-right shrink-0 ${eficienciaColor}`}>
          {terminal.eficiencia}%
        </span>
      </div>
      {/* Mini efficiency bar */}
      <div className="ml-9 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
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
      className={`flex items-center gap-3 py-2.5 border-b border-neutral-800/40 last:border-0 rounded-xl px-1 -mx-1 ${flashing ? 'wb-flash' : ''}`}
    >
      <span
        className={`text-xs font-black w-5 text-right shrink-0 ${isTop3 ? 'text-red-500' : 'text-neutral-700'}`}
      >
        {rank}
      </span>
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-white font-bold uppercase text-xs tracking-wide truncate">
          {item.nombre}
        </span>
        <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${isTop3 ? 'bg-red-600' : 'bg-neutral-600'} transition-all duration-1000`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
      <span className="text-white font-black italic text-lg w-8 text-right shrink-0">
        {item.total}
      </span>
    </div>
  )
})

/**
 * Dashboard Planta — Wallboard view for call center TVs.
 *
 * Architecture notes:
 * - Rango selector (HOY / 7D / 30D / HISTÓRICO) persisted in localStorage.
 * - Supabase Realtime channel is ALWAYS active regardless of selected range;
 *   on any DB event it re-fetches the full dataset for the current range so
 *   counters and rankings update in real-time even on historical views.
 * - cargarDatosRef pattern keeps the realtime callback pointing to the latest
 *   cargarDatos without recreating the Supabase channel on every range change.
 * - flashKey increments on each live update; KPI/row sub-components watch it
 *   to trigger a brief CSS flash animation (wbFlash keyframe).
 */
export default function DashboardPlantaPage() {
  const [rango, setRangoState] = useState<RangoWallboard>('HOY')
  const [llamadas, setLlamadasRaw] = useState<LlamadaConConcesionario[]>([])
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [pulse, setPulse] = useState(false)
  const [flashKey, setFlashKey] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hydrate rango from localStorage (client-only)
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY) as RangoWallboard | null
    if (saved && RANGOS.some((r) => r.key === saved)) {
      setRangoState(saved)
    }
  }, [])

  const setRango = useCallback((r: RangoWallboard) => {
    setRangoState(r)
    localStorage.setItem(LS_KEY, r)
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    try {
      const [rows, aliases] = await Promise.all([
        fetchLlamadasWallboard(rango),
        fetchAliasMap(),
      ])
      setLlamadasRaw(rows)
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

  // Keep a ref so the realtime callback always calls the latest version
  // without the channel needing to be recreated on each range change.
  const cargarDatosRef = useRef(cargarDatos)
  useEffect(() => { cargarDatosRef.current = cargarDatos }, [cargarDatos])

  // ── Polling (restarts on range change) ───────────────────────────────────

  useEffect(() => {
    cargarDatos()
    intervalRef.current = setInterval(cargarDatos, REFRESH_INTERVAL_MS)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [cargarDatos])

  // ── Realtime (created once — always active) ───────────────────────────────

  useEffect(() => {
    const channel = supabase
      .channel('wallboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'llamadas' },
        () => { void cargarDatosRef.current() }
      )
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, []) // intentionally empty — channel lives for the full mount lifecycle

  // ── Derived data ──────────────────────────────────────────────────────────

  const kpis: KPIStats = useMemo(() => calcularKPIs(llamadas), [llamadas])

  const franjas: FranjaEficiencia[] = useMemo(
    () => calcularEficienciaFranjas(llamadas),
    [llamadas]
  )

  const maxFranjaTotal = useMemo(
    () => Math.max(...franjas.map((f) => f.total), 1),
    [franjas]
  )

  const terminales: TerminalRanking[] = useMemo(
    () => calcularRankingTerminales(llamadas, aliasMap),
    [llamadas, aliasMap]
  )

  const topConces: ConcesionarioRanking[] = useMemo(
    () => calcularTopConcesionarios(llamadas, 10),
    [llamadas]
  )

  const maxConcesTotal = useMemo(
    () => Math.max(...topConces.map((c) => c.total), 1),
    [topConces]
  )

  const eficienciaColor =
    kpis.eficiencia >= 80
      ? 'text-green-400'
      : kpis.eficiencia >= 60
      ? 'text-yellow-400'
      : 'text-red-500'

  const eficienciaBarColor =
    kpis.eficiencia >= 80
      ? 'bg-green-500'
      : kpis.eficiencia >= 60
      ? 'bg-yellow-500'
      : 'bg-red-600'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="h-screen overflow-hidden bg-[#0F0F0F] text-white flex flex-col select-none"
      style={{ fontFamily: 'inherit' }}
    >
      {/* Flash CSS keyframe */}
      <style>{FLASH_CSS}</style>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between px-10 py-4 border-b border-neutral-800 bg-black/60">
        {/* Logo + Title */}
        <div className="flex items-center gap-5">
          <div className="bg-red-600 px-3 py-2 rounded-xl text-white font-black italic text-xl shadow-[0_0_20px_rgba(220,38,38,0.5)]">
            CT
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-3xl font-black italic uppercase tracking-tighter text-white">
              CRUCI <span className="text-red-600">TRACK</span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mt-1">
              Call Center Wallboard
            </span>
          </div>
        </div>

        {/* Rango tabs */}
        <div className="flex items-center gap-1 border border-neutral-800 rounded-xl p-1 bg-neutral-900/70">
          {RANGOS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRango(key)}
              className={`
                px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest
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
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div
              className={`w-2.5 h-2.5 rounded-full bg-red-600 transition-all duration-300 ${pulse ? 'scale-150 opacity-100' : 'opacity-70 animate-pulse'}`}
            />
            <span className="text-red-600 text-xs font-black uppercase tracking-widest italic">
              LIVE
            </span>
            {lastUpdate && (
              <span
                suppressHydrationWarning
                className="text-neutral-700 text-[10px] font-bold uppercase tracking-widest"
              >
                Act. {lastUpdate.toLocaleTimeString('es-AR', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </div>
          <WallboardClock />
        </div>
      </header>

      {/* ── KPI BAR ─────────────────────────────────────────────────────── */}
      <section className="shrink-0 flex gap-4 px-10 py-4">
        <KpiHero
          label="Entrantes Totales"
          value={loading ? '—' : kpis.total}
          sub="llamadas"
          valueColor="text-white"
          icon={<PhoneIncoming size={28} />}
          flashKey={flashKey}
        />
        <KpiHero
          label="Atendidas"
          value={loading ? '—' : kpis.atendidas}
          sub="resp."
          valueColor="text-green-400"
          icon={<Activity size={28} />}
          flashKey={flashKey}
        />
        <KpiHero
          label="Perdidas (07–19hs)"
          value={loading ? '—' : kpis.perdidasComerciales}
          sub="sin resp."
          valueColor="text-red-500"
          icon={<PhoneMissed size={28} />}
          flashKey={flashKey}
        />
        <KpiHero
          label="Eficiencia General"
          value={loading ? '—' : `${kpis.eficiencia}%`}
          sub={RANGOS.find((r) => r.key === rango)?.label.toLowerCase()}
          valueColor={eficienciaColor}
          icon={<TrendingUp size={28} />}
          progress={loading ? 0 : kpis.eficiencia}
          progressColor={eficienciaBarColor}
          flashKey={flashKey}
        />
      </section>

      {/* ── MAIN CONTENT ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex gap-4 px-10 pb-4 min-h-0">

        {/* ── COL 1: Ranking Terminales ─────────────────────────────────── */}
        <div className="w-[22%] shrink-0 bg-neutral-900/50 border border-neutral-800 rounded-3xl flex flex-col overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-neutral-800 shrink-0 flex items-center gap-3">
            <Monitor size={16} className="text-red-600" />
            <span className="text-xs font-black uppercase tracking-widest italic text-white">
              Ranking Terminales
            </span>
          </div>
          {/* Column headers */}
          <div className="flex items-center gap-4 px-6 py-2 shrink-0">
            <span className="text-neutral-700 text-[9px] font-black uppercase w-5 text-right shrink-0">#</span>
            <span className="flex-1 text-neutral-600 text-[9px] font-black uppercase">Terminal</span>
            <span className="text-neutral-600 text-[9px] font-black uppercase w-8 text-right shrink-0">Total</span>
            <span className="text-neutral-600 text-[9px] font-black uppercase w-10 text-right shrink-0">Efic.</span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 pb-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Wifi size={20} className="text-red-600 animate-pulse" />
              </div>
            ) : terminales.length === 0 ? (
              <p className="text-neutral-700 text-xs font-black uppercase italic text-center mt-8">
                Sin actividad
              </p>
            ) : (
              terminales.map((t, i) => (
                <TerminalRow key={t.id} terminal={t} rank={i + 1} flashKey={flashKey} />
              ))
            )}
          </div>
        </div>

        {/* ── COL 2: Análisis por Franja Horaria ───────────────────────── */}
        <div className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-3xl flex flex-col overflow-hidden">
          <div className="px-6 pt-5 pb-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={16} className="text-red-600" />
              <span className="text-xs font-black uppercase tracking-widest italic text-white">
                Análisis por Franja Horaria
              </span>
            </div>
            <span className="text-neutral-600 text-[9px] font-black uppercase tracking-widest italic">
              Ventana Comercial 07–19 hs
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-around px-8 py-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Wifi size={24} className="text-red-600 animate-pulse" />
              </div>
            ) : (
              franjas.map((f) => (
                <FranjaRow key={f.label} franja={f} maxTotal={maxFranjaTotal} />
              ))
            )}
          </div>

          {/* Summary bar */}
          {!loading && (
            <div className="px-8 py-4 border-t border-neutral-800 shrink-0 flex items-center justify-between bg-black/30">
              <span className="text-neutral-600 text-[10px] font-black uppercase tracking-widest italic">
                {RANGO_LABEL[rango]}:
              </span>
              <div className="flex items-center gap-6">
                <span className="text-white text-sm font-black italic">
                  {kpis.atendidas}
                  <span className="text-neutral-600 text-xs ml-1">atendidas</span>
                </span>
                <span className="text-neutral-400 text-xs font-bold">/</span>
                <span className="text-white text-sm font-black italic">
                  {kpis.total}
                  <span className="text-neutral-600 text-xs ml-1">total</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── COL 3: Top 10 Concesionarios + Acceso Mapa ──────────────── */}
        <div className="w-[28%] shrink-0 flex flex-col gap-4">

          {/* Top 10 Concesionarios */}
          <div className="flex-1 bg-neutral-900/50 border border-neutral-800 rounded-3xl flex flex-col overflow-hidden min-h-0">
            <div className="px-6 pt-5 pb-3 border-b border-neutral-800 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp size={16} className="text-red-600" />
                <span className="text-xs font-black uppercase tracking-widest italic text-white">
                  Top 10 Concesionarios
                </span>
              </div>
              <span className="text-neutral-600 text-[9px] font-black uppercase tracking-widest italic">
                {RANGOS.find((r) => r.key === rango)?.label}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Wifi size={20} className="text-red-600 animate-pulse" />
                </div>
              ) : topConces.length === 0 ? (
                <p className="text-neutral-700 text-xs font-black uppercase italic text-center mt-8">
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

          {/* Acceso rápido al mapa */}
          <Link
            href="/mapa"
            className="h-[18%] shrink-0 bg-neutral-900/30 border border-neutral-800 hover:border-red-600/50 rounded-3xl flex items-center justify-center gap-4 transition-all duration-300 group hover:bg-red-600/5"
          >
            <div className="p-3 bg-neutral-800 group-hover:bg-red-600 rounded-2xl transition-all duration-300">
              <Map size={20} className="text-neutral-400 group-hover:text-white transition-colors" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-neutral-400 group-hover:text-white font-black italic uppercase text-sm tracking-tight transition-colors">
                Mapa de Actividad
              </span>
              <span className="text-neutral-700 text-[9px] font-black uppercase tracking-widest mt-1">
                Ver distribución geográfica →
              </span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
