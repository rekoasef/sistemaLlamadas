'use client'

import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import {
  FileText, Plus, Trash2, Clock, ChevronRight, FileSearch,
  X, Mail, Download, AlertTriangle, Zap, Shield,
  ArrowDownLeft, ArrowUpRight, PhoneOff, PhoneCall,
  BarChart3, Calendar, CheckCircle2, XCircle, Loader2,
  TrendingUp, Activity,
} from 'lucide-react'
import { fetchReportes, insertReporte, deleteReporte } from '@/services/reportes.service'
import { fetchLlamadasByRange } from '@/services/llamadas.service'
import { calcularKPIs, generarResumenEjecutivo, calcularFugasPorFranja, UMBRAL_EFICIENCIA } from '@/lib/kpi'
import { calcularTopConcesionarios } from '@/lib/wallboard'
import { exportarReportePDF, exportarReportePDFComoBase64 } from '@/lib/pdf'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { SkeletonReporteCard } from '@/components/ui/SkeletonCard'
import { DESTINATARIOS_DEFAULT } from '@/lib/email-config'
import type { Reporte, FranjaPerdidas, ReporteMetricas } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Scroll-lock hook
// ─────────────────────────────────────────────────────────────────────────────

function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [locked])
}

// ─────────────────────────────────────────────────────────────────────────────
// Document viewer sub-components
// ─────────────────────────────────────────────────────────────────────────────

/** Single KPI metric tile inside the document viewer */
const MetricTile = memo(function MetricTile({
  icon, label, value, color, bg, border, glow = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bg: string
  border: string
  glow?: boolean
}) {
  return (
    <div className={`relative flex flex-col gap-3 p-6 rounded-3xl border ${bg} ${border} overflow-hidden group`}>
      {glow && (
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
          <div className="absolute inset-0 bg-red-600/5 rounded-3xl" />
        </div>
      )}
      <div className={`${color} opacity-60`}>{icon}</div>
      <div className="relative z-10">
        <p className={`text-4xl font-black italic tracking-tighter leading-none ${color}`}>
          {value}
        </p>
        <p className="text-[9px] text-neutral-600 font-black uppercase tracking-[0.2em] mt-2">
          {label}
        </p>
      </div>
    </div>
  )
})

/** Parses and renders the resumen_escrito as styled sections — replaces <pre> completely */
const ResumenViewer = memo(function ResumenViewer({ text }: { text: string | null }) {
  if (!text) return null

  const lines = text.split('\n')

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // Blank line → spacer
        if (!trimmed) return <div key={i} className="h-3" />

        // Divider line (--- or -----)
        if (/^-{3,}$/.test(trimmed)) {
          return <div key={i} className="border-t border-neutral-800/60 my-2" />
        }

        // ALERTA: → highlighted red block
        if (trimmed.startsWith('ALERTA:')) {
          return (
            <div key={i} className="flex items-start gap-3 bg-red-600/10 border border-red-600/30 rounded-2xl px-5 py-4 my-3">
              <XCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-red-400 font-black uppercase text-[11px] tracking-wide leading-relaxed">
                <span className="text-red-600">ALERTA:</span>{' '}
                {trimmed.replace('ALERTA:', '').trim()}
              </p>
            </div>
          )
        }

        // ESTADO ÓPTIMO → green block
        if (trimmed.startsWith('ESTADO ÓPTIMO:')) {
          return (
            <div key={i} className="flex items-start gap-3 bg-green-500/10 border border-green-500/30 rounded-2xl px-5 py-4 my-3">
              <CheckCircle2 size={16} className="text-green-500 shrink-0 mt-0.5" />
              <p className="text-green-400 font-black uppercase text-[11px] tracking-wide leading-relaxed">
                <span className="text-green-500">ESTADO ÓPTIMO:</span>{' '}
                {trimmed.replace('ESTADO ÓPTIMO:', '').trim()}
              </p>
            </div>
          )
        }

        // FRANJA CRÍTICA → yellow highlight
        if (trimmed.startsWith('FRANJA CRÍTICA:')) {
          return (
            <div key={i} className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-5 py-3 my-2">
              <AlertTriangle size={14} className="text-yellow-500 shrink-0" />
              <p className="text-yellow-400 font-black uppercase text-[10px] tracking-widest">
                {trimmed}
              </p>
            </div>
          )
        }

        // Bullet items (·)
        if (trimmed.startsWith('·')) {
          return (
            <div key={i} className="flex items-start gap-3 pl-2">
              <div className="w-1 h-1 bg-neutral-600 rounded-full mt-2 shrink-0" />
              <p className="text-neutral-400 font-mono text-[11px] uppercase tracking-wide leading-relaxed">
                {trimmed.replace('·', '').trim()}
              </p>
            </div>
          )
        }

        // Section headings (ALL CAPS ending with : or standalone)
        if (
          trimmed === trimmed.toUpperCase() &&
          trimmed.length > 4 &&
          !trimmed.includes(' ') === false &&
          (trimmed.endsWith(':') || /^[A-Z\s]+$/.test(trimmed))
        ) {
          return (
            <p key={i} className="text-[10px] font-black text-red-600/80 uppercase tracking-[0.4em] italic mt-4 mb-1">
              {trimmed.replace(/:$/, '')}
            </p>
          )
        }

        // Regular paragraph
        return (
          <p key={i} className="text-neutral-400 text-[12px] uppercase tracking-wide leading-loose font-medium">
            {trimmed}
          </p>
        )
      })}
    </div>
  )
})

/** Franja horaria bar inside the document viewer */
const FranjaCell = memo(function FranjaCell({
  franja, isWorst,
}: {
  franja: FranjaPerdidas
  isWorst: boolean
}) {
  const pct = franja.porcentaje
  const barColor = pct > 50 ? 'bg-red-600' : pct > 25 ? 'bg-yellow-500' : 'bg-green-500'
  const textColor = pct > 50 ? 'text-red-500' : pct > 25 ? 'text-yellow-500' : 'text-green-500'

  return (
    <div className={`p-5 rounded-2xl border transition-all ${isWorst
      ? 'border-red-600/50 bg-red-600/5 shadow-[0_0_20px_rgba(220,38,38,0.08)]'
      : 'border-neutral-800/60 bg-black/20'}`}
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-neutral-500 font-black text-[10px] uppercase tracking-widest">
          {franja.label}
        </span>
        {isWorst && (
          <span className="text-[8px] font-black text-red-600 uppercase tracking-widest bg-red-600/10 px-2 py-0.5 rounded-full border border-red-600/20">
            CRÍTICA
          </span>
        )}
      </div>
      <p className={`text-3xl font-black italic tracking-tighter leading-none mb-3 ${textColor}`}>
        {pct}%
      </p>
      <div className="w-full bg-neutral-800/50 h-1.5 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${barColor} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[9px] text-neutral-700 font-black uppercase tracking-widest">
        {franja.perdidas} / {franja.total} llamadas
      </p>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Full Document Viewer Modal
// ─────────────────────────────────────────────────────────────────────────────

const DocumentViewer = memo(function DocumentViewer({
  reporte,
  onClose,
  onExport,
}: {
  reporte: Reporte
  onClose: () => void
  onExport: (r: Reporte) => void
}) {
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'ok' | 'error'>('idle')

  const m = reporte.metricas
  const eficiencia = m?.eficiencia ?? 0
  const isOptimal = eficiencia >= UMBRAL_EFICIENCIA
  const perdidas = (m?.total ?? 0) - (m?.atendidas ?? 0)
  const pctPerdidas = (m?.total ?? 0) > 0
    ? Math.round((perdidas / (m?.total ?? 1)) * 100)
    : 0

  // Legacy reports (auto-generated before v2.2) may not have entrantes/salientes
  const hasBreakdown = (m?.entrantes ?? 0) + (m?.salientes ?? 0) > 0

  const franjas = useMemo(() => (m as ReporteMetricas | null)?.franjas ?? [], [m])
  const franjasCritica = useMemo(() => {
    if (!franjas.length) return null
    return [...franjas].filter(f => f.total > 0).sort((a, b) => b.porcentaje - a.porcentaje)[0] ?? null
  }, [franjas])

  const topConces = useMemo(() => (m as ReporteMetricas | null)?.topConcesionarios ?? [], [m])

  const handleEnviar = useCallback(async () => {
    setSending(true)
    setSendStatus('idle')
    try {
      const pdfBase64 = exportarReportePDFComoBase64(reporte)
      const periodo = `${new Date(reporte.rango_inicio + 'T12:00:00').toLocaleDateString('es-AR')} — ${new Date(reporte.rango_fin + 'T12:00:00').toLocaleDateString('es-AR')}`
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: reporte.titulo,
          periodo,
          resumen: reporte.resumen_escrito ?? '',
          pdfBase64,
          destinatarios: DESTINATARIOS_DEFAULT,
        }),
      })
      if (!res.ok) throw new Error('Error en el servidor')
      setSendStatus('ok')
    } catch {
      setSendStatus('error')
    } finally {
      setSending(false)
    }
  }, [reporte])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/95 backdrop-blur-2xl overflow-y-auto p-4 pt-8 pb-16"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-4xl animate-in zoom-in-95 fade-in duration-300">

        {/* ── Document shell ─────────────────────────────────────────────── */}
        <div className="bg-neutral-950 border border-neutral-800/80 rounded-[2.5rem] overflow-hidden shadow-[0_0_80px_rgba(0,0,0,0.8)]">

          {/* ── Document header / seal ──────────────────────────────────── */}
          <div className="relative bg-gradient-to-r from-neutral-900 to-black border-b border-neutral-800/60 overflow-hidden">
            {/* Red accent strip */}
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600 shadow-[0_0_20px_rgba(220,38,38,0.6)]" />

            {/* Background texture */}
            <div className="absolute inset-0 opacity-[0.015]" style={{
              backgroundImage: 'repeating-linear-gradient(0deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 40px)',
            }} />

            <div className="relative z-10 px-10 pt-8 pb-6">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  {/* System label */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="bg-red-600 px-3 py-1 rounded-lg shadow-[0_0_10px_rgba(220,38,38,0.4)]">
                      <span className="text-white font-black italic text-[9px] tracking-[0.3em] uppercase">CT</span>
                    </div>
                    <span className="text-neutral-600 text-[9px] font-black uppercase tracking-[0.4em]">
                      Cruci-Track · Auditoría Crucianelli
                    </span>
                    <div className="flex items-center gap-2 ml-auto">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                      <span className="text-neutral-700 text-[8px] font-black uppercase tracking-widest">
                        Documento Oficial
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="text-5xl font-black text-white italic uppercase tracking-tighter leading-none mb-4">
                    {reporte.titulo}
                  </h2>

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2 text-neutral-500">
                      <Calendar size={13} className="text-neutral-700" />
                      <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                        {new Date(reporte.rango_inicio + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                      <span className="text-neutral-700">—</span>
                      <span className="text-[10px] font-black uppercase tracking-widest font-mono">
                        {new Date(reporte.rango_fin + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                        reporte.tipo === 'AUTOMATICO'
                          ? 'text-blue-500 bg-blue-600/10 border-blue-600/20'
                          : 'text-neutral-500 bg-neutral-800/60 border-neutral-700'
                      }`}>
                        {reporte.tipo ?? 'MANUAL'}
                      </span>

                      <span className={`text-[8px] font-black uppercase tracking-widest px-3 py-1 rounded-full border flex items-center gap-1.5 ${
                        isOptimal
                          ? 'text-green-500 bg-green-500/10 border-green-500/20'
                          : 'text-red-600 bg-red-600/10 border-red-600/20'
                      }`}>
                        {isOptimal ? <CheckCircle2 size={9} /> : <AlertTriangle size={9} />}
                        {isOptimal ? 'APROBADO' : 'BAJO UMBRAL'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seal / close */}
                <div className="flex flex-col items-end gap-3 shrink-0">
                  <button
                    onClick={onClose}
                    className="p-3 bg-neutral-800/80 rounded-2xl text-neutral-500 hover:text-white hover:bg-neutral-700 transition-all"
                  >
                    <X size={20} />
                  </button>
                  {/* Efficiency badge — large stamp */}
                  <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center shrink-0 ${
                    isOptimal
                      ? 'border-green-500/40 bg-green-500/5'
                      : 'border-red-600/40 bg-red-600/5'
                  }`}>
                    <span className={`text-xl font-black italic leading-none tracking-tighter ${isOptimal ? 'text-green-500' : 'text-red-600'}`}>
                      {eficiencia}%
                    </span>
                    <span className="text-[7px] font-black uppercase text-neutral-600 tracking-widest mt-0.5">
                      EFIC.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Document ID footer stripe */}
            <div className="px-10 py-3 bg-black/40 border-t border-neutral-800/40 flex items-center gap-6">
              <span className="text-[8px] font-mono text-neutral-700 uppercase tracking-widest">
                ID: {reporte.id.substring(0, 16).toUpperCase()}
              </span>
              <span className="text-[8px] font-mono text-neutral-800 uppercase tracking-widest">
                INTEGRIDAD: {btoa(reporte.id).substring(0, 20).toUpperCase()}
              </span>
              {reporte.creado_at && (
                <span className="text-[8px] font-mono text-neutral-700 uppercase tracking-widest ml-auto">
                  GENERADO: {new Date(reporte.creado_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────────── */}
          <div className="px-10 py-10 space-y-10">

            {/* Section 1 — Metrics Grid */}
            <section>
              <SectionLabel icon={<Activity size={13} />} label="Métricas Operativas" />

              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-5">
                <MetricTile
                  icon={<PhoneCall size={18} />}
                  label="Total Red"
                  value={m?.total ?? 0}
                  color="text-white"
                  bg="bg-white/5"
                  border="border-neutral-800/60"
                />
                <MetricTile
                  icon={<ArrowDownLeft size={18} />}
                  label="Entrantes"
                  value={hasBreakdown ? (m?.entrantes ?? 0) : 'N/D'}
                  color="text-blue-400"
                  bg="bg-blue-500/5"
                  border="border-blue-500/20"
                />
                <MetricTile
                  icon={<ArrowUpRight size={18} />}
                  label="Salientes"
                  value={hasBreakdown ? (m?.salientes ?? 0) : 'N/D'}
                  color="text-purple-400"
                  bg="bg-purple-500/5"
                  border="border-purple-500/20"
                />
                <MetricTile
                  icon={<CheckCircle2 size={18} />}
                  label="Atendidas"
                  value={m?.atendidas ?? 0}
                  color="text-green-400"
                  bg="bg-green-500/5"
                  border="border-green-500/20"
                />
                {/* Perdidas — prominence mandated */}
                <div className="relative flex flex-col gap-3 p-6 rounded-3xl border border-red-600/40 bg-red-600/5 overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-red-600/10 rounded-full blur-2xl pointer-events-none" />
                  <PhoneOff size={18} className="text-red-600 relative z-10" />
                  <div className="relative z-10">
                    <p className="text-4xl font-black italic tracking-tighter leading-none text-red-600">
                      {perdidas}
                    </p>
                    <p className="text-[9px] text-red-800 font-black uppercase tracking-[0.2em] mt-2">
                      Perdidas
                    </p>
                    {pctPerdidas > 0 && (
                      <span className="inline-block mt-2 text-[8px] font-black text-red-600/80 bg-red-600/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        {pctPerdidas}% del total
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Section 2 — Efficiency Gauge */}
            <section>
              <SectionLabel icon={<Zap size={13} />} label="Ratio de Eficiencia (Franja 07–19hs)" />

              <div className="mt-5 bg-black/30 border border-neutral-800/60 rounded-3xl p-8 flex items-center gap-8">
                {/* Big number */}
                <div className="shrink-0 text-center">
                  <p className={`text-8xl font-black italic tracking-tighter leading-none ${isOptimal ? 'text-green-400' : 'text-red-600'}`}>
                    {eficiencia}
                    <span className="text-4xl">%</span>
                  </p>
                  <p className="text-[9px] text-neutral-600 font-black uppercase tracking-widest mt-2">
                    Eficiencia
                  </p>
                </div>

                <div className="flex-1 space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest">
                        Rendimiento vs umbral ({UMBRAL_EFICIENCIA}%)
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isOptimal ? 'text-green-500' : 'text-red-600'}`}>
                        {isOptimal ? `+${eficiencia - UMBRAL_EFICIENCIA}% sobre umbral` : `${UMBRAL_EFICIENCIA - eficiencia}% bajo umbral`}
                      </span>
                    </div>
                    <div className="relative w-full bg-neutral-800 h-3 rounded-full overflow-hidden">
                      {/* Umbral marker */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-yellow-500/60 z-10"
                        style={{ left: `${UMBRAL_EFICIENCIA}%` }}
                      />
                      {/* Fill */}
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${isOptimal
                          ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.5)]'
                          : 'bg-red-600 shadow-[0_0_12px_rgba(220,38,38,0.5)]'
                        }`}
                        style={{ width: `${eficiencia}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-[8px] text-neutral-700 font-black uppercase">0%</span>
                      <span className="text-[8px] text-yellow-600 font-black uppercase">Umbral {UMBRAL_EFICIENCIA}%</span>
                      <span className="text-[8px] text-neutral-700 font-black uppercase">100%</span>
                    </div>
                  </div>

                  {/* Atendidas vs Perdidas bars */}
                  <div className="space-y-2">
                    <CompactBar
                      label="Atendidas"
                      value={m?.atendidas ?? 0}
                      total={m?.total ?? 1}
                      color="bg-green-500"
                      textColor="text-green-400"
                    />
                    <CompactBar
                      label="Perdidas"
                      value={perdidas}
                      total={m?.total ?? 1}
                      color="bg-red-600"
                      textColor="text-red-500"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section 3 — Franjas (conditional) */}
            {franjas.length > 0 && (
              <section>
                <SectionLabel icon={<BarChart3 size={13} />} label="Análisis de Fuga por Franja Horaria" badge={franjasCritica ? `CRÍTICA: ${franjasCritica.label}` : undefined} />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5">
                  {franjas.map((f) => (
                    <FranjaCell
                      key={f.label}
                      franja={f}
                      isWorst={franjasCritica?.label === f.label}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Section 4 — Top 10 Concesionarios (conditional) */}
            {topConces.length > 0 && (
              <section>
                <SectionLabel icon={<TrendingUp size={13} />} label="Top 10 Concesionarios por Actividad" />
                <div className="mt-5 bg-black/30 border border-neutral-800/40 rounded-3xl p-6 space-y-1">
                  {topConces.map((item, i) => {
                    const maxT = topConces[0]?.total ?? 1
                    const pct = Math.round((item.total / maxT) * 100)
                    const isTop3 = i < 3
                    return (
                      <div key={item.nombre} className="flex items-center gap-4 py-2 border-b border-neutral-800/40 last:border-0">
                        <span className={`text-xs font-black w-5 text-right shrink-0 ${isTop3 ? 'text-red-500' : 'text-neutral-700'}`}>
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-bold text-xs uppercase tracking-wide truncate mb-1">{item.nombre}</p>
                          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${isTop3 ? 'bg-red-600' : 'bg-neutral-600'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                        <span className={`text-sm font-black italic shrink-0 w-8 text-right ${isTop3 ? 'text-red-500' : 'text-neutral-400'}`}>
                          {item.total}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Section 5 — Executive Summary (zero <pre>) */}
            <section>
              <SectionLabel icon={<FileText size={13} />} label="Resumen Ejecutivo" />
              <div className="mt-5 bg-black/30 border border-neutral-800/40 rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-6 right-6 opacity-5 pointer-events-none">
                  <Shield size={80} className="text-white" />
                </div>
                <ResumenViewer text={reporte.resumen_escrito} />
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-col gap-3 pt-2 border-t border-neutral-800/40">
              {sendStatus === 'ok' && (
                <div className="flex items-center gap-3 bg-green-600/10 border border-green-600/30 rounded-2xl px-5 py-3">
                  <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                  <p className="text-green-400 text-[10px] font-black uppercase tracking-wide">
                    Informe enviado correctamente a todos los destinatarios
                  </p>
                </div>
              )}
              {sendStatus === 'error' && (
                <div className="flex items-center gap-3 bg-red-600/10 border border-red-600/30 rounded-2xl px-5 py-3">
                  <AlertTriangle size={14} className="text-red-500 shrink-0" />
                  <p className="text-red-400 text-[10px] font-black uppercase tracking-wide">
                    Error al enviar el correo. Verificá la configuración.
                  </p>
                </div>
              )}
              <div className="flex gap-4">
                <button
                  onClick={handleEnviar}
                  disabled={sending}
                  className="flex-1 py-5 bg-neutral-900 border border-neutral-800 text-neutral-400 rounded-2xl font-black uppercase text-[10px] italic flex items-center justify-center gap-3 hover:bg-neutral-800 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                  {sending ? 'Enviando...' : 'Enviar a Gerencia'}
                </button>
                <button
                  onClick={() => onExport(reporte)}
                  className="flex-1 py-5 bg-red-600 text-white rounded-2xl font-black uppercase text-[10px] italic flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-[0_0_20px_rgba(220,38,38,0.2)] active:scale-95"
                >
                  <Download size={16} /> Exportar PDF Oficial
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Shared micro-components
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ icon, label, badge }: { icon: React.ReactNode; label: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="text-red-600/70">{icon}</div>
      <span className="text-[10px] font-black text-neutral-400 uppercase tracking-[0.4em] italic">{label}</span>
      {badge && (
        <span className="ml-auto text-[8px] font-black text-red-600 uppercase tracking-widest bg-red-600/10 px-3 py-1 rounded-full border border-red-600/20">
          {badge}
        </span>
      )}
      <div className="flex-1 h-px bg-neutral-800/60 ml-1" />
    </div>
  )
}

function CompactBar({ label, value, total, color, textColor }: {
  label: string; value: number; total: number; color: string; textColor: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[9px] text-neutral-600 font-black uppercase tracking-widest w-16 shrink-0">{label}</span>
      <div className="flex-1 bg-neutral-800/50 h-2 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-[10px] font-black italic tracking-tighter w-8 text-right shrink-0 ${textColor}`}>{value}</span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Archive card
// ─────────────────────────────────────────────────────────────────────────────

interface ReporteCardProps {
  reporte: Reporte
  onOpen: (r: Reporte) => void
  onDelete: (id: string) => void
}

const ReporteCard = memo(function ReporteCard({ reporte, onOpen, onDelete }: ReporteCardProps) {
  const eficiencia = reporte.metricas?.eficiencia ?? 0
  const isOptimal = eficiencia >= UMBRAL_EFICIENCIA
  const isAuto = reporte.tipo === 'AUTOMATICO'
  const total = reporte.metricas?.total ?? 0
  const atendidas = reporte.metricas?.atendidas ?? 0
  const perdidas = total - atendidas

  return (
    <div className="group relative bg-gradient-to-b from-neutral-900/60 to-neutral-950/80 border border-neutral-800/80 p-8 rounded-[2.5rem] hover:border-neutral-700 transition-all overflow-hidden backdrop-blur-sm shadow-xl">
      {/* Hover glow */}
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-red-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Top row */}
      <div className="flex justify-between items-start mb-7 relative z-10">
        <div className={`p-3.5 rounded-2xl ${isAuto ? 'bg-blue-600/10 text-blue-500 border border-blue-600/20' : 'bg-red-600/10 text-red-500 border border-red-600/20'}`}>
          <FileText size={20} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${isAuto ? 'text-blue-500 bg-blue-600/10 border-blue-600/20' : 'text-neutral-600 bg-neutral-800/60 border-neutral-700/60'}`}>
            {isAuto ? 'AUTO' : 'MANUAL'}
          </span>
          <button
            onClick={() => onDelete(reporte.id)}
            className="p-2 text-neutral-800 hover:text-red-600 transition-colors rounded-xl hover:bg-red-600/10"
            aria-label="Eliminar"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Title & dates */}
      <h3 className="text-xl font-black italic uppercase text-white mb-1 leading-tight tracking-tighter group-hover:text-red-400 transition-colors relative z-10 line-clamp-2">
        {reporte.titulo}
      </h3>
      <div className="flex items-center gap-2 text-neutral-700 mb-7 relative z-10">
        <Calendar size={10} />
        <p className="text-[9px] font-mono uppercase tracking-widest">
          {new Date(reporte.rango_inicio + 'T12:00:00').toLocaleDateString('es-AR')} — {new Date(reporte.rango_fin + 'T12:00:00').toLocaleDateString('es-AR')}
        </p>
      </div>

      {/* Metrics mini-grid */}
      <div className="grid grid-cols-3 gap-3 mb-6 border-t border-neutral-800/50 pt-6 relative z-10">
        <div className="text-center">
          <p className="text-white font-black italic text-2xl tracking-tighter leading-none">{total}</p>
          <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Total</p>
        </div>
        <div className="text-center">
          <p className={`font-black italic text-2xl tracking-tighter leading-none ${isOptimal ? 'text-green-400' : 'text-red-500'}`}>{eficiencia}%</p>
          <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Efic.</p>
        </div>
        <div className="text-center">
          <p className="text-red-600 font-black italic text-2xl tracking-tighter leading-none">{perdidas}</p>
          <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">Perdidas</p>
        </div>
      </div>

      {/* Efficiency bar */}
      <div className="w-full bg-neutral-900 h-1 rounded-full overflow-hidden mb-7 relative z-10 border border-neutral-800/40">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isOptimal ? 'bg-green-500' : 'bg-red-600'}`}
          style={{ width: `${eficiencia}%` }}
        />
      </div>

      <button
        onClick={() => onOpen(reporte)}
        className="w-full py-4 bg-neutral-900/80 group-hover:bg-red-600 text-neutral-600 group-hover:text-white text-[9px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all flex items-center justify-center gap-2 italic border border-neutral-800/50 group-hover:border-red-600 relative z-10"
      >
        VER DOCUMENTO <ChevronRight size={12} />
      </button>
    </div>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function InformesPage() {
  const [reportes, setReportes] = useState<Reporte[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showNewModal, setShowNewModal] = useState(false)
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [titulo, setTitulo] = useState('')

  const [selectedReporte, setSelectedReporte] = useState<Reporte | null>(null)

  // ── Scroll lock — body.overflow = 'hidden' while any modal is open ────────
  useScrollLock(showNewModal || selectedReporte !== null)

  // ── Data ──────────────────────────────────────────────────────────────────

  const cargarReportes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setReportes(await fetchReportes())
    } catch (err) {
      setError('Error al cargar el archivo de informes.')
      console.error('[InformesPage] cargarReportes:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { cargarReportes() }, [cargarReportes])

  // ── Generation ────────────────────────────────────────────────────────────

  const generarReporteManual = useCallback(async () => {
    if (!fechaInicio || !fechaFin) return
    setIsGenerating(true)
    setError(null)
    try {
      const llamadas = await fetchLlamadasByRange(fechaInicio, fechaFin)
      const kpis = calcularKPIs(llamadas)
      const franjas = calcularFugasPorFranja(llamadas)
      const topConcesionarios = calcularTopConcesionarios(llamadas, 10)
      const resumen = generarResumenEjecutivo(kpis, fechaInicio, fechaFin, franjas)

      await insertReporte({
        titulo: titulo.trim() || `REPORTE ${fechaInicio.replace(/-/g, '/')}`,
        rango_inicio: fechaInicio,
        rango_fin: fechaFin,
        metricas: {
          total: kpis.total,
          entrantes: kpis.entrantes,
          salientes: kpis.salientes,
          atendidas: kpis.atendidas,
          eficiencia: kpis.eficiencia,
          franjas,
          topConcesionarios,
        } as unknown as import('@/types/supabase').Json,
        resumen_escrito: resumen,
        tipo: 'MANUAL',
      })

      setShowNewModal(false)
      setTitulo('')
      setFechaInicio('')
      setFechaFin('')
      await cargarReportes()
    } catch (err) {
      setError('Error al generar el informe. Verifica el rango e intenta nuevamente.')
      console.error('[InformesPage] generarReporteManual:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [fechaInicio, fechaFin, titulo, cargarReportes])

  const handleEliminar = useCallback(async (id: string) => {
    if (!confirm('¿ELIMINAR ESTE INFORME DEL ARCHIVO HISTÓRICO?\nEsta acción no se puede deshacer.')) return
    try {
      await deleteReporte(id)
      if (selectedReporte?.id === id) setSelectedReporte(null)
      await cargarReportes()
    } catch (err) {
      console.error('[InformesPage] handleEliminar:', err)
    }
  }, [cargarReportes, selectedReporte])

  // ── Stats ─────────────────────────────────────────────────────────────────

  const archiveStats = useMemo(() => ({
    total: reportes.length,
    automaticos: reportes.filter((r) => r.tipo === 'AUTOMATICO').length,
    manuales: reportes.filter((r) => r.tipo === 'MANUAL').length,
  }), [reportes])

  const canGenerate = Boolean(fechaInicio && fechaFin && fechaFin >= fechaInicio)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ErrorBoundary>
      <div className="max-w-7xl mx-auto space-y-10 pb-20 px-4 pt-10 animate-in fade-in duration-700">

        {/* ── Page header ─────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-neutral-800 pb-12 gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-1.5 w-1.5 bg-red-600 rounded-full animate-pulse" />
              <span className="text-red-600 text-[9px] font-black uppercase tracking-[0.4em] italic">
                Cruci-Track Document System v2.1
              </span>
            </div>
            <h1 className="text-7xl font-black text-white italic uppercase tracking-tighter leading-none">
              CENTRO DE{' '}
              <span className="text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                INFORMES
              </span>
            </h1>
            <p className="text-neutral-600 text-[10px] font-bold uppercase tracking-[0.3em] mt-4 italic">
              Auditoría Documental · Métricas de Fuga · Memoria Operativa de Red
            </p>
          </div>

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-4 bg-red-600 hover:bg-red-700 text-white px-10 py-5 rounded-[2rem] font-black italic uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(220,38,38,0.2)] active:scale-95 shrink-0"
          >
            <Plus size={20} /> Generar Nuevo Informe
          </button>
        </div>

        {/* ── Archive stats ───────────────────────────────────────────── */}
        {!loading && reportes.length > 0 && (
          <div className="grid grid-cols-3 gap-5">
            {[
              { label: 'Informes Archivados', value: archiveStats.total,       color: 'text-white',    icon: <FileText size={16} /> },
              { label: 'Automáticos (Cron)',  value: archiveStats.automaticos, color: 'text-blue-400', icon: <TrendingUp size={16} /> },
              { label: 'Manuales',            value: archiveStats.manuales,    color: 'text-red-500',  icon: <Zap size={16} /> },
            ].map(({ label, value, color, icon }) => (
              <div key={label} className="bg-neutral-900/40 border border-neutral-800/60 px-7 py-5 rounded-[2rem] flex items-center gap-4">
                <div className={`${color} opacity-40`}>{icon}</div>
                <div>
                  <p className={`text-2xl font-black italic tracking-tighter leading-none ${color}`}>{value}</p>
                  <p className="text-[8px] text-neutral-700 font-black uppercase tracking-widest mt-1">{label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ───────────────────────────────────────────────────── */}
        {error && !showNewModal && (
          <div className="flex items-start gap-4 px-7 py-5 bg-red-600/10 border border-red-600/30 rounded-2xl animate-in fade-in">
            <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-red-500 text-[10px] font-black uppercase tracking-widest">{error}</p>
          </div>
        )}

        {/* ── Grid ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonReporteCard key={i} />)
          ) : reportes.length === 0 ? (
            <div className="col-span-full py-40 border-2 border-dashed border-neutral-800/40 rounded-[3rem] text-center">
              <FileSearch size={44} className="mx-auto text-neutral-800 mb-5" />
              <p className="text-neutral-600 font-black italic uppercase tracking-widest text-sm">
                Archivo vacío
              </p>
              <p className="text-neutral-800 text-[9px] font-black uppercase tracking-widest mt-2">
                Los reportes automáticos se generan cada viernes a las 19:00hs
              </p>
            </div>
          ) : (
            reportes.map((rep) => (
              <ReporteCard
                key={rep.id}
                reporte={rep}
                onOpen={setSelectedReporte}
                onDelete={handleEliminar}
              />
            ))
          )}
        </div>

        {/* ── Document viewer modal ──────────────────────────────────── */}
        {selectedReporte && (
          <DocumentViewer
            reporte={selectedReporte}
            onClose={() => setSelectedReporte(null)}
            onExport={exportarReportePDF}
          />
        )}

        {/* ── New report modal ───────────────────────────────────────── */}
        {showNewModal && (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setShowNewModal(false); setError(null) } }}
          >
            <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
              {/* Modal header stripe */}
              <div className="h-1 w-full bg-gradient-to-r from-red-600 to-red-900" />

              <div className="p-10">
                <div className="flex items-center justify-between mb-9">
                  <div>
                    <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">
                      Nuevo Informe
                    </h2>
                    <p className="text-neutral-600 text-[9px] font-black uppercase tracking-widest mt-1.5 italic">
                      Configurar parámetros de auditoría
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowNewModal(false); setError(null) }}
                    className="p-3 text-neutral-700 hover:text-white bg-neutral-800/80 rounded-2xl hover:bg-neutral-700 transition-all"
                  >
                    <X size={17} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] mb-2.5 italic">
                      Identificador
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="EJ: MARZO SEMANA 1"
                      className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white font-black italic uppercase outline-none focus:border-red-600 transition-all text-[11px] tracking-wider"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] mb-2.5 italic">
                        Desde
                      </label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white text-[10px] font-black uppercase outline-none focus:border-red-600 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-neutral-600 uppercase tracking-[0.3em] mb-2.5 italic">
                        Hasta
                      </label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        min={fechaInicio}
                        className="w-full bg-black border border-neutral-800 rounded-2xl px-5 py-4 text-white text-[10px] font-black uppercase outline-none focus:border-red-600 transition-all"
                      />
                    </div>
                  </div>

                  {fechaInicio && fechaFin && fechaFin < fechaInicio && (
                    <p className="text-red-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                      <AlertTriangle size={12} /> La fecha de fin debe ser posterior al inicio.
                    </p>
                  )}

                  {error && !isGenerating && (
                    <div className="flex items-start gap-3 bg-red-600/10 border border-red-600/20 rounded-xl px-4 py-3">
                      <AlertTriangle size={13} className="text-red-600 shrink-0 mt-0.5" />
                      <p className="text-red-500 text-[9px] font-black uppercase tracking-widest">{error}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-4 border-t border-neutral-800/60">
                    <button
                      onClick={() => { setShowNewModal(false); setError(null) }}
                      className="flex-1 py-4 text-neutral-600 font-black uppercase text-[10px] tracking-widest italic hover:text-white transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={generarReporteManual}
                      disabled={isGenerating || !canGenerate}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest italic shadow-lg disabled:opacity-30 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                      {isGenerating ? (
                        <><Loader2 size={14} className="animate-spin" /> Generando...</>
                      ) : 'Confirmar'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </ErrorBoundary>
  )
}
