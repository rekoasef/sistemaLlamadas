'use client'

import { useEffect, useState, useMemo, memo } from 'react'
import {
  BarChart3, TrendingUp, Zap, AlertTriangle,
  Clock, ChevronRight, Mail, ArrowDownLeft, ArrowUpRight,
} from 'lucide-react'
import { fetchTodasLasLlamadas } from '@/services/llamadas.service'
import { fetchAliasMap } from '@/services/alias.service'
import {
  calcularStatsPorTerminal,
  calcularStatsHorarias,
  calcularFugasPorConcesionario,
  calcularEficienciaDiaria,
  UMBRAL_EFICIENCIA,
  type DiaEficiencia,
} from '@/lib/kpi'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkeletonBarRow } from '@/components/ui/SkeletonCard'
import type { LlamadaConConcesionario, AliasMap, TerminalStats, FugaStats } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

interface MiniCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
  glow?: boolean
}

/** Compact KPI tile for the analytics summary row. */
const MiniCard = memo(function MiniCard({
  icon, label, value, sub = '', color = 'text-red-600', glow = false,
}: MiniCardProps) {
  return (
    <div
      className={`bg-neutral-900 border border-neutral-800 p-9 rounded-[2.5rem] flex items-center gap-6 group hover:border-white transition-all shadow-2xl relative overflow-hidden ${glow ? 'hover:shadow-red-900/20' : ''}`}
    >
      <div
        className={`bg-neutral-800 p-5 rounded-2xl ${color} group-hover:bg-red-600 group-hover:text-white transition-all shadow-inner group-hover:scale-110`}
      >
        {icon}
      </div>
      <div className="relative z-10">
        <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-3 italic">
          {label}
        </p>
        <p className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none group-hover:text-red-500 transition-colors">
          {value}
        </p>
        {sub && (
          <p className="text-[8px] text-neutral-600 font-bold uppercase mt-2 tracking-widest leading-none">
            {sub}
          </p>
        )}
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Line chart — 30-day efficiency trend
// ─────────────────────────────────────────────────────────────────────────────

const EficienciaLineChart = memo(function EficienciaLineChart({
  data,
}: {
  data: DiaEficiencia[]
}) {
  const W = 900
  const H = 200
  const PAD = { top: 24, right: 32, bottom: 36, left: 44 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const xScale = (i: number) =>
    PAD.left + (data.length > 1 ? (i / (data.length - 1)) : 0.5) * innerW
  const yScale = (v: number) => PAD.top + (1 - v / 100) * innerH
  const umbralY = yScale(UMBRAL_EFICIENCIA)

  // Build connected line segments (split at gaps where total === 0)
  const segments: string[][] = []
  let cur: string[] = []
  for (let i = 0; i < data.length; i++) {
    const d = data[i]
    if (d.eficiencia >= 0) {
      cur.push(`${xScale(i).toFixed(1)},${yScale(d.eficiencia).toFixed(1)}`)
    } else if (cur.length > 0) {
      segments.push(cur)
      cur = []
    }
  }
  if (cur.length > 0) segments.push(cur)

  const yGrids = [0, 25, 50, 75, 100]

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 200 }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="eficGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dc2626" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#dc2626" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal grid */}
      {yGrids.map((v) => (
        <g key={v}>
          <line
            x1={PAD.left} y1={yScale(v)}
            x2={W - PAD.right} y2={yScale(v)}
            stroke="#1f1f1f" strokeWidth="1"
          />
          <text
            x={PAD.left - 6} y={yScale(v) + 4}
            textAnchor="end" fill="#3f3f3f"
            fontSize="9" fontFamily="monospace"
          >
            {v}%
          </text>
        </g>
      ))}

      {/* Umbral 80% */}
      <line
        x1={PAD.left} y1={umbralY}
        x2={W - PAD.right} y2={umbralY}
        stroke="#ca8a04" strokeWidth="1.2" strokeDasharray="5 4"
      />
      <text
        x={W - PAD.right + 4} y={umbralY + 4}
        fill="#ca8a04" fontSize="8" fontFamily="monospace"
      >
        {UMBRAL_EFICIENCIA}%
      </text>

      {/* Line segments */}
      {segments.map((pts, si) => (
        <path key={si} d={`M ${pts.join(' L ')}`} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" />
      ))}

      {/* Data points */}
      {data.map((d, i) => {
        if (d.eficiencia < 0) return null
        const cx = xScale(i)
        const cy = yScale(d.eficiencia)
        const ok = d.eficiencia >= UMBRAL_EFICIENCIA
        return (
          <g key={d.fecha}>
            <circle cx={cx} cy={cy} r="4" fill={ok ? '#22c55e' : '#dc2626'} stroke="#0a0a0a" strokeWidth="1.5" />
          </g>
        )
      })}

      {/* X axis labels — every 5 days + last day */}
      {data.map((d, i) => {
        if (i % 5 !== 0 && i !== data.length - 1) return null
        const fecha = new Date(`${d.fecha}T12:00:00`)
        const label = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
        return (
          <text key={d.fecha} x={xScale(i)} y={H - 4} textAnchor="middle" fill="#3f3f3f" fontSize="8" fontFamily="monospace">
            {label}
          </text>
        )
      })}

      {/* X axis baseline */}
      <line
        x1={PAD.left} y1={H - PAD.bottom}
        x2={W - PAD.right} y2={H - PAD.bottom}
        stroke="#262626" strokeWidth="1"
      />
    </svg>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inteligencia BI — system-wide analytics dashboard.
 *
 * Fetches the full call history once (no realtime subscription needed here —
 * the BI view is refreshed manually). Alias resolution is client-side via
 * an in-memory map to keep the analytics queries clean.
 *
 * Commercial hours rule (07:00–19:00) is enforced inside the kpi.ts helpers,
 * which are shared with the Dashboard and Report generation engine.
 */
export default function AnaliticaPage() {
  const [llamadas, setLlamadas] = useState<LlamadaConConcesionario[]>([])
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  const [loading, setLoading] = useState(true)
  const [emailReporte, setEmailReporte] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [calls, aliases] = await Promise.all([
          fetchTodasLasLlamadas(),
          fetchAliasMap(),
        ])
        setLlamadas(calls)
        setAliasMap(aliases)
      } catch (err) {
        console.error('[AnaliticaPage] load:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // ── Derived analytics ─────────────────────────────────────────────────────

  /** Per-terminal performance, alias-resolved, commercial-hours filtered. */
  const statsPorPuesto = useMemo<TerminalStats[]>(
    () => calcularStatsPorTerminal(llamadas, aliasMap),
    [llamadas, aliasMap]
  )

  /** 24-slot hourly traffic distribution for the density bar chart. */
  const statsHorarias = useMemo<number[]>(
    () => calcularStatsHorarias(llamadas),
    [llamadas]
  )

  /** Top-6 dealerships ranked by missed calls (commercial hours only). */
  const fugasPorConcesionario = useMemo<FugaStats[]>(
    () => calcularFugasPorConcesionario(llamadas),
    [llamadas]
  )

  /** Day-by-day efficiency for the last 30 days. */
  const eficienciaDiaria = useMemo<DiaEficiencia[]>(
    () => calcularEficienciaDiaria(llamadas, 30),
    [llamadas]
  )

  const totalEntrantes = useMemo(
    () => llamadas.filter((l) => l.tipo_llamada?.toUpperCase() === 'ENTRANTE').length,
    [llamadas]
  )
  const totalSalientes = llamadas.length - totalEntrantes

  const totalPerdidasComerciales = useMemo(
    () =>
      llamadas.filter((l) => {
        const h = l.fecha_llamada ? new Date(l.fecha_llamada).getHours() : 0
        return l.estado?.toUpperCase() !== 'ATENDIDA' && h >= 7 && h < 19
      }).length,
    [llamadas]
  )

  const maxHoraria = Math.max(...statsHorarias, 1)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-12 pb-20 animate-in fade-in duration-1000 px-4">

        {/* Header */}
        <div className="border-b border-neutral-800 pb-10 mt-10 text-center lg:text-left relative overflow-hidden">
          <div className="absolute top-0 right-0 p-20 bg-red-600/5 blur-[100px] rounded-full" />
          <h1 className="text-6xl md:text-8xl font-black text-white italic uppercase tracking-tighter leading-none relative">
            BI{' '}
            <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">CRUCI</span>
          </h1>
          <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-[0.4em] mt-4 italic">
            Auditoría de Red Operativa (v2.0) | Franja Comercial: 07:00 - 19:00
          </p>
        </div>

        {/* KPI summary row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Total volume tile — custom layout with entrantes/salientes split */}
          <div className="bg-neutral-900 border border-neutral-800 p-8 rounded-[2.5rem] shadow-2xl flex flex-col justify-between group hover:border-red-600/50 transition-all relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 text-neutral-800/20 group-hover:text-red-600/10 transition-colors">
              <TrendingUp size={80} />
            </div>
            <div className="relative z-10">
              <p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest italic mb-4">
                Volumen Total Red
              </p>
              <div className="flex items-end gap-2 mb-6">
                <span className="text-6xl font-black text-white italic tracking-tighter group-hover:scale-105 transition-transform">
                  {loading ? '—' : llamadas.length}
                </span>
                <span className="text-neutral-600 text-[10px] font-bold uppercase mb-2 italic">
                  Llamadas
                </span>
              </div>
              <div className="grid grid-cols-2 border-t border-neutral-800 pt-5 gap-4">
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-blue-500 font-black italic">
                    <ArrowDownLeft size={14} /> {totalEntrantes}
                  </div>
                  <span className="text-[8px] text-neutral-600 font-bold uppercase">Entrantes</span>
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-1 text-green-500 font-black italic">
                    <ArrowUpRight size={14} /> {totalSalientes}
                  </div>
                  <span className="text-[8px] text-neutral-600 font-bold uppercase">Salientes</span>
                </div>
              </div>
            </div>
          </div>

          <MiniCard
            icon={<Zap />}
            label="Terminal con más llamadas"
            value={loading ? '—' : statsPorPuesto[0]?.alias ?? 'N/A'}
            color="text-yellow-500"
            sub="MAYOR PRODUCTIVIDAD"
          />
          <MiniCard
            icon={<AlertTriangle />}
            label="Llamadas Perdidas"
            value={loading ? '—' : totalPerdidasComerciales}
            color="text-red-600"
            sub="7-19 HS COMERCIAL"
            glow
          />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Terminal performance bar chart */}
          <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl backdrop-blur-md hover:border-red-600/30 transition-all">
            <div className="flex items-center gap-3 mb-10">
              <BarChart3 className="text-red-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">
                Rendimiento Operativo por Terminal
              </h3>
            </div>
            <div className="space-y-10">
              {loading
                ? Array.from({ length: 4 }).map((_, i) => <SkeletonBarRow key={i} />)
                : statsPorPuesto.map((p) => {
                    const porcentaje = Math.round((p.atendidas / p.total) * 100)
                    return (
                      <div key={p.id} className="group">
                        <div className="flex justify-between items-end mb-3">
                          <span className="text-white font-black italic uppercase text-2xl group-hover:text-red-500 transition-all tracking-tighter">
                            {p.alias}
                          </span>
                          <div className="text-right">
                            <span className="text-white font-black italic text-xl">{porcentaje}%</span>
                            <p className="text-[8px] text-neutral-600 font-bold uppercase tracking-widest">
                              {p.atendidas} de {p.total} Atendidas
                            </p>
                          </div>
                        </div>
                        <div className="w-full bg-neutral-800 h-2.5 rounded-full overflow-hidden p-[2px] border border-neutral-700 shadow-inner">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(220,38,38,0.3)] ${porcentaje > 70 ? 'bg-green-500' : porcentaje > 40 ? 'bg-yellow-500' : 'bg-red-600'}`}
                            style={{ width: `${porcentaje}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
            </div>
          </div>

          {/* Hourly traffic density chart */}
          <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl flex flex-col backdrop-blur-md hover:border-red-600/30 transition-all">
            <div className="flex items-center gap-3 mb-10">
              <Clock className="text-red-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">
                Densidad de Tráfico Horario
              </h3>
            </div>
            <div className="flex-1 flex items-end justify-between gap-1 h-64 border-b border-neutral-800 pb-4">
              {statsHorarias.map((count, i) => {
                const height = (count / maxHoraria) * 100
                const esComercial = i >= 7 && i < 19
                return (
                  <div
                    key={i}
                    className={`transition-all rounded-t-sm relative group flex-1 ${esComercial ? 'bg-red-600 hover:bg-white' : 'bg-neutral-800 hover:bg-neutral-600'}`}
                    style={{ height: `${height}%` }}
                  >
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black text-[9px] font-black px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-all z-10 whitespace-nowrap">
                      {i}:00hs | {count} Lls
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-between mt-6 text-[8px] font-black text-neutral-600 uppercase italic tracking-[0.2em] px-2">
              <span>00:00 AM</span>
              <span className="text-red-600 animate-pulse">FRANJA AUDITADA (07-19)</span>
              <span>11:59 PM</span>
            </div>
          </div>
        </div>

        {/* 30-day efficiency trend */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl backdrop-blur-md hover:border-red-600/30 transition-all">
          <div className="flex items-center justify-between gap-3 mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="text-red-600" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">
                Eficiencia — Últimos 30 Días
              </h3>
            </div>
            <div className="flex items-center gap-5 text-[8px] font-black uppercase tracking-widest">
              <span className="flex items-center gap-1.5 text-green-500">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Sobre umbral
              </span>
              <span className="flex items-center gap-1.5 text-red-500">
                <span className="w-2 h-2 rounded-full bg-red-600 inline-block" /> Bajo umbral
              </span>
              <span className="flex items-center gap-1.5 text-yellow-600">
                <span className="w-4 border-t border-dashed border-yellow-600 inline-block" /> Umbral {UMBRAL_EFICIENCIA}%
              </span>
            </div>
          </div>

          {loading ? (
            <div className="h-[200px] flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-red-600/30 border-t-red-600 rounded-full animate-spin" />
            </div>
          ) : (
            <EficienciaLineChart data={eficienciaDiaria} />
          )}

          {/* Stats row below chart */}
          {!loading && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-800/50">
              {(() => {
                const conDatos = eficienciaDiaria.filter((d) => d.eficiencia >= 0)
                const promedio = conDatos.length > 0
                  ? Math.round(conDatos.reduce((s, d) => s + d.eficiencia, 0) / conDatos.length)
                  : 0
                const diasOk = conDatos.filter((d) => d.eficiencia >= UMBRAL_EFICIENCIA).length
                const mejor = conDatos.length > 0 ? Math.max(...conDatos.map((d) => d.eficiencia)) : 0
                return (
                  <>
                    <div className="text-center">
                      <p className={`text-2xl font-black italic tracking-tighter ${promedio >= UMBRAL_EFICIENCIA ? 'text-green-400' : 'text-red-500'}`}>{promedio}%</p>
                      <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Promedio 30d</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black italic tracking-tighter text-white">{diasOk}<span className="text-neutral-600 text-sm">/{conDatos.length}</span></p>
                      <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Días sobre umbral</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-black italic tracking-tighter text-green-400">{mejor}%</p>
                      <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Mejor día</p>
                    </div>
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Missed calls ranking */}
        <div className="bg-neutral-900/40 border border-neutral-800 p-10 rounded-[3rem] shadow-2xl transition-all hover:border-red-600/20">
          <div className="flex items-center gap-3 mb-10">
            <AlertTriangle className="text-red-600" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">
              Ranking de Llamadas Perdidas
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fugasPorConcesionario.map((f, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-7 bg-black/40 border border-neutral-800 rounded-3xl group hover:border-red-600 transition-all shadow-lg"
              >
                <div className="flex flex-col">
                  <span className="text-white font-black italic uppercase text-xl leading-none group-hover:text-red-500 transition-colors tracking-tighter">
                    {f.nombre}
                  </span>
                  <span className="text-[8px] text-neutral-600 font-black mt-2 uppercase italic tracking-widest">
                    Atención en Riesgo
                  </span>
                </div>
                <div className="bg-red-600/10 px-5 py-2 rounded-2xl border border-red-600/20 shadow-inner group-hover:bg-red-600 group-hover:text-white transition-all">
                  <span className="font-black text-2xl italic leading-none">{f.cantidad}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Email subscription footer */}
        <div className="bg-red-600 p-12 rounded-[3.5rem] flex flex-col lg:flex-row items-center justify-between gap-8 shadow-2xl shadow-red-600/30 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-32 bg-white/10 blur-[80px] rounded-full group-hover:scale-150 transition-transform duration-1000" />
          <div className="text-center lg:text-left relative z-10">
            <div className="flex items-center justify-center lg:justify-start gap-4 mb-3 text-white">
              <Mail size={40} className="drop-shadow-lg" />
              <h3 className="text-4xl font-black italic uppercase leading-none tracking-tighter">
                Reportes Semanales
              </h3>
            </div>
            <p className="text-white/80 text-[11px] font-bold uppercase tracking-[0.2em] italic">
              Análisis de eficiencia operativa y auditoría de red industrial
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto relative z-10">
            <input
              type="email"
              placeholder="ADMIN@CRUCIANELLI.COM"
              className="bg-black/20 border-2 border-white/20 rounded-2xl px-8 py-5 text-white placeholder:text-white/40 text-xs font-black outline-none focus:border-white focus:bg-black/40 transition-all w-full lg:w-80 uppercase italic"
              onChange={(e) => setEmailReporte(e.target.value)}
            />
            <button
              onClick={() => alert(`Suscripción activada para ${emailReporte}`)}
              className="bg-white text-red-600 px-10 py-5 rounded-2xl font-black uppercase text-[10px] italic hover:bg-black hover:text-white transition-all flex items-center justify-center gap-3 group shadow-2xl"
            >
              Suscripción BI <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

      </div>
    </ErrorBoundary>
  )
}
