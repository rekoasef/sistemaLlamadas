'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  PhoneIncoming, PhoneOutgoing, Activity, Monitor, RefreshCw,
  ArrowDownLeft, ArrowUpRight, Zap, Clock, Wifi, AlertCircle,
  Hourglass, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { fetchLlamadas, fetchLlamadaById } from '@/services/llamadas.service'
import { fetchAliasMap } from '@/services/alias.service'
import { calcularKPIs, formatDuracion } from '@/lib/kpi'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkeletonStatCard, SkeletonTableRow } from '@/components/ui/SkeletonCard'
import ModalVincular from '@/components/ModalVincular'
import { supabase } from '@/lib/supabase'
import type { LlamadaConConcesionario, AliasMap, FiltroLlamadas, PeriodoRapido } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Live clock widget showing current Argentina time.
 * Uses a mount flag to avoid SSR/CSR hydration mismatch.
 */
function LiveClock() {
  const [time, setTime] = useState(new Date())
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-2xl border border-neutral-800 backdrop-blur-xl group hover:border-red-600 transition-all min-w-[220px]">
      <Clock size={20} className="text-red-600 animate-pulse" />
      <div className="flex flex-col justify-center">
        <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] leading-none mb-1">
          {mounted
            ? time.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '--/--/----'}
        </span>
        <span className="text-white font-black italic text-base tracking-tighter leading-none uppercase">
          {mounted ? time.toLocaleTimeString('es-AR', { hour12: false }) : '--:--:--'} HS
        </span>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

/**
 * Panel General — real-time call telemetry dashboard.
 *
 * Architecture notes:
 * - Alias map is fetched separately and held in memory to avoid JOIN overhead
 *   on the realtime-subscribed llamadas query.
 * - Realtime handler fetches the full row for any changed ID rather than
 *   trusting the partial payload, ensuring joined fields (concesionario name)
 *   are always present.
 * - Client-side filtering (filtroDispositivo) avoids additional DB roundtrips.
 */
export default function DashboardPage() {
  const [llamadasRaw, setLlamadasRaw] = useState<LlamadaConConcesionario[]>([])
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [selectedNum, setSelectedNum] = useState('')
  const [eventFlash, setEventFlash] = useState(false)
  const [todayFlash, setTodayFlash] = useState(false)
  const [filtroDispositivo, setFiltroDispositivo] = useState('TODOS')

  // Filter state — passed directly to the service layer
  const [filtro, setFiltro] = useState<FiltroLlamadas>({
    usarCalendario: false,
    periodo: 'total',
    fechaEspecifica: '',
    mesSeleccionado: new Date().getMonth() + 1,
    anioSeleccionado: new Date().getFullYear(),
  })

  const setPeriodo = useCallback((periodo: PeriodoRapido) => {
    setFiltro((prev) => ({ ...prev, periodo }))
  }, [])

  const setUsarCalendario = useCallback((usarCalendario: boolean) => {
    setFiltro((prev) => ({ ...prev, usarCalendario }))
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setLoading(true)
    try {
      const [llamadas, aliases] = await Promise.all([
        fetchLlamadas(filtro),
        fetchAliasMap(),
      ])
      setLlamadasRaw(llamadas)
      setAliasMap(aliases)
    } catch (err) {
      console.error('[DashboardPage] cargarDatos:', err)
    } finally {
      setLoading(false)
    }
  }, [filtro])

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    cargarDatos()

    const channel = supabase
      .channel('dashboard-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'llamadas' },
        async (payload) => {
          setEventFlash(true)
          setTimeout(() => setEventFlash(false), 2000)
          setTodayFlash(true)
          setTimeout(() => setTodayFlash(false), 2000)

          const changedId =
            (payload.new as { id?: string })?.id ??
            (payload.old as { id?: string })?.id

          if (!changedId) return

          const fullRow = await fetchLlamadaById(changedId)
          if (!fullRow) return

          setLlamadasRaw((prev) => {
            const idx = prev.findIndex((l) => l.id === fullRow.id)
            if (idx !== -1) {
              const next = [...prev]
              next[idx] = fullRow
              return next
            }
            return [fullRow, ...prev].slice(0, 200)
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [cargarDatos])

  // ── Derived data ──────────────────────────────────────────────────────────

  /** Client-side device filter — O(n) pass, no additional DB query needed. */
  const filtradas = useMemo(
    () =>
      filtroDispositivo === 'TODOS'
        ? llamadasRaw
        : llamadasRaw.filter((ll) => ll.dispositivo_id === filtroDispositivo),
    [llamadasRaw, filtroDispositivo]
  )

  const stats = useMemo(() => calcularKPIs(filtradas), [filtradas])

  const llamadasHoy = useMemo(() => {
    const hoy = new Date()
    const prefix = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    return filtradas.filter((ll) => ll.fecha_llamada?.startsWith(prefix) ?? false)
  }, [filtradas])

  const statsHoy = useMemo(() => calcularKPIs(llamadasHoy), [llamadasHoy])

  const dispositivosUnicos = useMemo(
    () => Array.from(new Set(llamadasRaw.map((l) => l.dispositivo_id).filter(Boolean))),
    [llamadasRaw]
  )

  const paginadas = useMemo(
    () => filtradas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [filtradas, currentPage]
  )

  const totalPages = Math.ceil(filtradas.length / ITEMS_PER_PAGE) || 1

  // Reset to page 1 when filter changes
  useEffect(() => { setCurrentPage(1) }, [filtradas])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div
        className={`max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700 pb-20 px-4 pt-10 ${eventFlash ? 'ring-1 ring-red-600/20' : ''}`}
      >
        {showModal && (
          <ModalVincular
            numero={selectedNum}
            onClose={() => setShowModal(false)}
            onSuccess={cargarDatos}
          />
        )}

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 border-b border-neutral-800 pb-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3 bg-red-600/10 w-fit px-4 py-1.5 rounded-full border border-red-600/20">
              <Wifi size={12} className="text-red-600 animate-pulse" />
              <span className="text-red-600 text-[9px] font-black uppercase tracking-widest italic">
                Live Telemetry Active
              </span>
            </div>
            <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
              PANEL{' '}
              <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.4)]">
                GENERAL
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <LiveClock />
            <div className="flex flex-col gap-3">
              {/* Mode toggle */}
              <div className="flex bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden self-end">
                <button
                  onClick={() => setUsarCalendario(false)}
                  className={`px-4 py-2 text-[9px] font-black uppercase transition-colors ${!filtro.usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}
                >
                  Rápido
                </button>
                <button
                  onClick={() => setUsarCalendario(true)}
                  className={`px-4 py-2 text-[9px] font-black uppercase transition-colors ${filtro.usarCalendario ? 'bg-red-600 text-white' : 'text-neutral-500'}`}
                >
                  Calendario
                </button>
              </div>

              <div className="flex items-center gap-4 bg-neutral-900/50 p-2 rounded-[2rem] border border-neutral-800 backdrop-blur-md">
                {!filtro.usarCalendario ? (
                  <div className="flex items-center gap-1">
                    {(['dia', 'semana', 'mes', 'total'] as PeriodoRapido[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setPeriodo(t)}
                        className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${filtro.periodo === t ? 'bg-red-600 text-white' : 'text-neutral-500 hover:text-white'}`}
                      >
                        {t === 'dia' ? 'Hoy' : t === 'semana' ? '7 Días' : t === 'mes' ? '30 Días' : 'Todo'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-2 items-center px-2">
                    <input
                      type="date"
                      value={filtro.fechaEspecifica}
                      onChange={(e) => setFiltro((p) => ({ ...p, fechaEspecifica: e.target.value }))}
                      className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none focus:border-red-600"
                    />
                    <select
                      value={filtro.mesSeleccionado}
                      onChange={(e) => setFiltro((p) => ({ ...p, mesSeleccionado: Number(e.target.value) }))}
                      className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none cursor-pointer"
                    >
                      {MESES.map((m, i) => (
                        <option key={m} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <select
                      value={filtro.anioSeleccionado}
                      onChange={(e) => setFiltro((p) => ({ ...p, anioSeleccionado: Number(e.target.value) }))}
                      className="bg-black border border-neutral-800 rounded-lg p-2 text-white text-[9px] font-black uppercase outline-none cursor-pointer"
                    >
                      {[2024, 2025, 2026].map((a) => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="h-8 w-px bg-neutral-800 mx-1" />

                {/* Device selector — shows human aliases */}
                <div className="flex items-center gap-2 bg-black/40 px-4 py-2 rounded-2xl border border-neutral-800 focus-within:border-red-600 transition-all">
                  <Monitor size={14} className="text-red-600" />
                  <select
                    className="bg-transparent text-red-600 text-[10px] font-black uppercase outline-none cursor-pointer"
                    onChange={(e) => setFiltroDispositivo(e.target.value)}
                    value={filtroDispositivo}
                  >
                    <option value="TODOS">TODOS LOS PUESTOS</option>
                    {dispositivosUnicos.map((id) => (
                      <option key={id} value={id ?? ''}>
                        {aliasMap[id ?? ''] ?? `PUESTO ${id}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {loading ? (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          ) : (
            <>
              {/* ── Tarjeta 1: Volumen ─────────────────────────────────────── */}
              <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[3.5rem] relative group overflow-hidden shadow-2xl transition-all hover:border-red-600/50 backdrop-blur-md">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest italic">
                    Volumen de Red
                  </p>
                  <PhoneIncoming size={32} className="text-red-600 opacity-10 group-hover:opacity-100 transition-all duration-700" />
                </div>

                {/* Número histórico */}
                <div className="flex items-baseline gap-3 group-hover:scale-105 transition-transform duration-500 mb-2">
                  <h2 className="text-7xl font-black italic text-white tracking-tighter leading-none">
                    {stats.total}
                  </h2>
                  <span className="text-neutral-600 text-xs font-black uppercase italic tracking-widest">
                    Histórico
                  </span>
                </div>

                {/* Entrantes/Salientes históricos */}
                <div className="flex gap-6 mb-5">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="text-blue-500" size={14} />
                    <span className="text-neutral-400 text-sm font-black italic">{stats.entrantes}</span>
                    <span className="text-[9px] text-neutral-600 font-black uppercase">Ent.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUpRight className="text-green-500" size={14} />
                    <span className="text-neutral-400 text-sm font-black italic">{stats.salientes}</span>
                    <span className="text-[9px] text-neutral-600 font-black uppercase">Sal.</span>
                  </div>
                </div>

                {/* Sección HOY */}
                <div className={`border-t border-neutral-800 pt-4 transition-all duration-300 ${todayFlash ? 'bg-white/5 rounded-2xl px-3 pb-2' : ''}`}>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-[0.25em] mb-3 italic">
                    HOY
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                      <ArrowDownLeft className="text-blue-500" size={16} />
                      <div>
                        <p className={`text-lg font-black italic leading-none ${todayFlash ? 'text-white' : 'text-neutral-300'}`}>
                          {statsHoy.entrantes}
                        </p>
                        <p className="text-[8px] text-neutral-600 font-black uppercase">Entrantes</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowUpRight className="text-green-500" size={16} />
                      <div>
                        <p className={`text-lg font-black italic leading-none ${todayFlash ? 'text-white' : 'text-neutral-300'}`}>
                          {statsHoy.salientes}
                        </p>
                        <p className="text-[8px] text-neutral-600 font-black uppercase">Salientes</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Tarjeta 2: Eficiencia ──────────────────────────────────── */}
              <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[3.5rem] relative group overflow-hidden shadow-2xl transition-all hover:border-red-600/50 backdrop-blur-md">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest italic">
                    Ratio Eficiencia
                  </p>
                  <Zap size={32} className="text-red-600 opacity-10 group-hover:opacity-100 transition-all duration-700" />
                </div>

                {/* % histórico */}
                <div className="flex items-baseline gap-3 group-hover:scale-105 transition-transform duration-500 mb-2">
                  <h2 className="text-7xl font-black italic text-green-500 tracking-tighter leading-none">
                    {stats.eficiencia}%
                  </h2>
                  <span className="text-neutral-600 text-xs font-black uppercase italic tracking-widest">
                    7–19hs
                  </span>
                </div>

                {/* Barra histórica */}
                <div className="w-full bg-neutral-800/50 h-1.5 rounded-full overflow-hidden border border-white/5 mb-5">
                  <div
                    className="bg-green-500 h-full transition-all duration-1000 shadow-[0_0_12px_rgba(34,197,94,0.5)]"
                    style={{ width: `${stats.eficiencia}%` }}
                  />
                </div>

                {/* Sección HOY */}
                <div className={`border-t border-neutral-800 pt-4 transition-all duration-300 ${todayFlash ? 'bg-white/5 rounded-2xl px-3 pb-2' : ''}`}>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-[0.25em] mb-3 italic">
                    HOY
                  </p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span
                      className={`text-2xl font-black italic tracking-tight leading-none transition-colors ${
                        statsHoy.eficiencia > stats.eficiencia
                          ? 'text-green-400'
                          : statsHoy.eficiencia < stats.eficiencia
                          ? 'text-red-500'
                          : 'text-neutral-400'
                      } ${todayFlash ? 'animate-pulse' : ''}`}
                    >
                      {statsHoy.eficiencia}%
                    </span>
                    <span className="text-[9px] text-neutral-600 font-black uppercase italic tracking-widest">
                      actual
                    </span>
                  </div>
                  {/* Mini barra de hoy */}
                  <div className="w-full bg-neutral-800/50 h-1 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full transition-all duration-700 ${
                        statsHoy.eficiencia > stats.eficiencia
                          ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]'
                          : statsHoy.eficiencia < stats.eficiencia
                          ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'
                          : 'bg-neutral-500'
                      }`}
                      style={{ width: `${statsHoy.eficiencia}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* ── Tarjeta 3: Pérdidas ────────────────────────────────────── */}
              <div className="bg-neutral-900/50 border border-neutral-800 p-8 rounded-[3.5rem] relative group overflow-hidden shadow-2xl transition-all hover:border-red-600/50 hover:shadow-red-900/30 backdrop-blur-md">
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-widest italic">
                    Llamadas entrantes Perdidas
                  </p>
                  <AlertCircle size={32} className="text-red-600 opacity-10 group-hover:opacity-100 group-hover:animate-bounce transition-all duration-700" />
                </div>

                {/* Número histórico */}
                <div className="flex items-baseline gap-3 group-hover:scale-105 transition-transform duration-500 mb-6">
                  <h2 className="text-7xl font-black italic text-red-600 tracking-tighter leading-none">
                    {stats.perdidasComerciales}
                  </h2>
                  <span className="text-neutral-600 text-xs font-black uppercase italic tracking-widest">
                    07–19hs
                  </span>
                </div>

                {/* Sección HOY */}
                <div className={`border-t border-neutral-800 pt-4 transition-all duration-300 ${todayFlash ? 'bg-white/5 rounded-2xl px-3 pb-2' : ''}`}>
                  <p className="text-[9px] text-neutral-500 font-black uppercase tracking-[0.25em] mb-3 italic">
                    HOY
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className={`text-2xl font-black italic tracking-tight leading-none text-red-500 ${todayFlash ? 'animate-pulse' : ''}`}>
                      {statsHoy.perdidasComerciales}
                    </span>
                    <span className="text-[9px] text-neutral-600 font-black uppercase italic tracking-widest">
                      perdidas hoy
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Activity Stream ─────────────────────────────────────────────── */}
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-[3.5rem] overflow-hidden shadow-2xl backdrop-blur-md">
          <div className="px-12 py-10 border-b border-neutral-800 bg-neutral-900/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-600 rounded-2xl shadow-[0_0_15px_rgba(220,38,38,0.4)]">
                <Activity size={18} className="text-white animate-pulse" />
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-[0.4em] text-white italic">
                  Activity Stream
                </h3>
                <p className="text-neutral-600 text-[9px] font-black uppercase mt-2 italic tracking-widest leading-none">
                  Sync Automático
                </p>
              </div>
            </div>
            <button
              onClick={cargarDatos}
              className="p-4 bg-neutral-800 hover:bg-red-600 rounded-2xl transition-all hover:rotate-180 duration-500"
            >
              <RefreshCw size={20} className={loading ? 'animate-spin text-white' : 'text-white'} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-600 border-b border-neutral-800/50">
                  <th className="px-12 py-6">Tipo / Estado</th>
                  <th className="px-12 py-6">Identificación</th>
                  <th className="px-12 py-6 text-center">Duración</th>
                  <th className="px-12 py-6 text-center">Protocolo</th>
                  <th className="px-12 py-6 text-right">Origen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/20">
                {loading
                  ? Array.from({ length: 8 }).map((_, i) => <SkeletonTableRow key={i} />)
                  : paginadas.map((ll) => (
                      <tr key={ll.id} className="hover:bg-red-600/[0.04] transition-all group">
                        <td className="px-12 py-8">
                          <div className="flex items-center gap-4">
                            <div
                              className={`p-2.5 rounded-xl ${ll.tipo_llamada === 'ENTRANTE' ? 'bg-blue-500/10 text-blue-500' : 'bg-purple-500/10 text-purple-500'}`}
                            >
                              {ll.tipo_llamada === 'ENTRANTE' ? (
                                <PhoneIncoming size={18} />
                              ) : (
                                <PhoneOutgoing size={18} />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase text-white leading-none mb-1">
                                {ll.tipo_llamada}
                              </span>
                              <span
                                className={`text-[8px] font-black uppercase italic ${ll.estado === 'ATENDIDA' ? 'text-green-500' : 'text-red-600'}`}
                              >
                                {ll.estado}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-12 py-8">
                          {ll.concesionarios?.nombre ? (
                            <div className="flex flex-col">
                              <span className="text-white font-black italic uppercase text-3xl group-hover:text-red-500 transition-colors leading-none tracking-tighter">
                                {ll.concesionarios.nombre}
                              </span>
                              <span className="text-[11px] text-neutral-600 font-mono italic mt-2 tracking-widest">
                                {ll.numero_telefono}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-6">
                              <span className="text-neutral-500 font-mono text-lg italic tracking-widest">
                                {ll.numero_telefono}
                              </span>
                              <button
                                onClick={() => {
                                  setSelectedNum(ll.numero_telefono ?? '')
                                  setShowModal(true)
                                }}
                                className="px-6 py-2.5 bg-neutral-800 border border-neutral-700 rounded-2xl text-red-600 hover:bg-red-600 hover:text-white transition-all text-[10px] font-black uppercase italic shadow-lg active:scale-95"
                              >
                                Vincular
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="px-12 py-8 text-center">
                          <div className="flex flex-col items-center">
                            <div className="flex items-center gap-2 text-white font-mono text-2xl font-bold tracking-tighter group-hover:text-red-600 transition-colors leading-none">
                              <Hourglass size={14} className="text-neutral-700" />
                              {formatDuracion(ll.duracion_segundos)}
                            </div>
                            <span className="text-[8px] font-black text-neutral-600 uppercase tracking-widest italic mt-1 leading-none">
                              Minutos
                            </span>
                          </div>
                        </td>

                        <td className="px-12 py-8 text-center">
                          <span
                            className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase border tracking-widest ${ll.estado?.toUpperCase() === 'ATENDIDA' ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-red-600/10 text-red-600 border-red-600/20 shadow-[0_0_15px_rgba(220,38,38,0.2)]'}`}
                          >
                            {ll.estado}
                          </span>
                        </td>

                        <td className="px-12 py-8 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span
                              suppressHydrationWarning
                              className="text-white font-black italic text-2xl tracking-tighter group-hover:text-red-500 transition-colors leading-none"
                            >
                              {ll.fecha_llamada
                                ? new Date(ll.fecha_llamada).toLocaleTimeString('es-AR', {
                                    hour12: false,
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : '--:--'}{' '}
                              HS
                            </span>
                            <span
                              suppressHydrationWarning
                              className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-none"
                            >
                              {ll.fecha_llamada
                                ? new Date(ll.fecha_llamada).toLocaleDateString('es-AR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                  })
                                : '--/--/----'}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] font-black text-neutral-600 uppercase italic tracking-widest mt-1">
                              <Monitor size={12} className="text-red-600" />
                              {/* Client-side alias resolution — avoids JOIN on realtime query */}
                              {ll.dispositivo_id
                                ? aliasMap[ll.dispositivo_id] ?? `ST-${ll.dispositivo_id}`
                                : 'S/D'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="px-12 py-8 bg-black/40 flex items-center justify-between border-t border-neutral-800">
            <p className="text-[10px] font-black text-neutral-500 italic uppercase">
              Página {currentPage} de {totalPages}
            </p>
            <div className="flex gap-4">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white hover:bg-red-600 disabled:opacity-20 transition-all active:scale-90"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl text-white hover:bg-red-600 disabled:opacity-20 transition-all active:scale-90"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
