'use client'

import { useState, useMemo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { Maximize2, Activity, MapPin } from 'lucide-react'
import Link from 'next/link'
import type { LlamadaConConcesionario } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON served from public/ — Argentina provinces (IGN, 24 features)
// ─────────────────────────────────────────────────────────────────────────────
const GEO_URL = '/argentina-provinces.json'

// ─────────────────────────────────────────────────────────────────────────────
// Normalize: strip accents + uppercase for province key matching
// ─────────────────────────────────────────────────────────────────────────────
export function normalizeText(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim()
}

const PROVINCE_ALIASES: Record<string, string> = {
  'CABA': 'CIUDAD AUTONOMA DE BUENOS AIRES',
  'CAPITAL FEDERAL': 'CIUDAD AUTONOMA DE BUENOS AIRES',
  'CIUDAD DE BUENOS AIRES': 'CIUDAD AUTONOMA DE BUENOS AIRES',
  'TIERRA DEL FUEGO': 'TIERRA DEL FUEGO, ANTARTIDA E ISLAS DEL ATLANTICO SUR',
  'TDF': 'TIERRA DEL FUEGO, ANTARTIDA E ISLAS DEL ATLANTICO SUR',
}

export function resolveProvince(raw: string): string {
  const norm = normalizeText(raw)
  return PROVINCE_ALIASES[norm] ?? norm
}

// ─────────────────────────────────────────────────────────────────────────────
// Color interpolation: #ffffb2 → #fd8d3c → #bd0026
// ─────────────────────────────────────────────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
}

const COLOR_STOPS: [number, [number, number, number]][] = [
  [0.0, hexToRgb('#ffffb2')],
  [0.5, hexToRgb('#fd8d3c')],
  [1.0, hexToRgb('#bd0026')],
]

export function callsToColor(count: number, max: number): string {
  if (count === 0 || max === 0) return '#1c1c1c'
  const t = Math.min(count / max, 1)
  let lo = COLOR_STOPS[0], hi = COLOR_STOPS[COLOR_STOPS.length - 1]
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (t >= COLOR_STOPS[i][0] && t <= COLOR_STOPS[i + 1][0]) { lo = COLOR_STOPS[i]; hi = COLOR_STOPS[i + 1]; break }
  }
  const s = hi[0] - lo[0], st = s > 0 ? (t - lo[0]) / s : 0
  return `rgb(${Math.round(lo[1][0] + (hi[1][0] - lo[1][0]) * st)},${Math.round(lo[1][1] + (hi[1][1] - lo[1][1]) * st)},${Math.round(lo[1][2] + (hi[1][2] - lo[1][2]) * st)})`
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface ConcesionarioPin {
  id: string
  nombre: string
  lat: number
  lon: number
  total: number
  atendidas: number
  ciudad: string
  provincia: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared data hooks — exported so the /mapa page can reuse them
// ─────────────────────────────────────────────────────────────────────────────
export function usePins(llamadas: LlamadaConConcesionario[]): ConcesionarioPin[] {
  return useMemo(() => {
    const map = new Map<string, ConcesionarioPin>()
    for (const l of llamadas) {
      if (!l.concesionario_id || !l.concesionarios) continue
      const c = l.concesionarios as any
      if (!c.latitud || !c.longitud) continue
      const ex = map.get(l.concesionario_id)
      if (ex) {
        ex.total++
        if (l.estado === 'ATENDIDA') ex.atendidas++
      } else {
        map.set(l.concesionario_id, {
          id: l.concesionario_id,
          nombre: c.nombre ?? '?',
          lat: c.latitud, lon: c.longitud,
          total: 1,
          atendidas: l.estado === 'ATENDIDA' ? 1 : 0,
          ciudad: c.ciudad ?? '', provincia: c.provincia ?? '',
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [llamadas])
}

export function useCallsByProvince(llamadas: LlamadaConConcesionario[]): Record<string, number> {
  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of llamadas) {
      const rawProv = (l.concesionarios as any)?.provincia
      if (rawProv && typeof rawProv === 'string') {
        const key = resolveProvince(rawProv)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return counts
  }, [llamadas])
}

// ─────────────────────────────────────────────────────────────────────────────
// MapCanvas — pure SVG map, used by both panel and page
// ─────────────────────────────────────────────────────────────────────────────
interface MapCanvasProps {
  pins: ConcesionarioPin[]
  callsByProvince: Record<string, number>
  maxCalls: number
  maxPinCalls: number
  /** 'mini' = smaller dots, grey provinces. 'full' = larger dots, choropleth bg */
  variant: 'mini' | 'full'
  hoveredPin: ConcesionarioPin | null
  onHoverPin: (pin: ConcesionarioPin | null) => void
}

export function MapCanvas({
  pins, callsByProvince, maxCalls, maxPinCalls,
  variant, hoveredPin, onHoverPin,
}: MapCanvasProps) {
  const scale = variant === 'full' ? 870 : 420
  const minR = variant === 'full' ? 5 : 2
  const maxR = variant === 'full' ? 18 : 7
  const getR = (total: number) =>
    maxPinCalls <= 1 ? minR : minR + (total / maxPinCalls) ** 0.6 * (maxR - minR)

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ center: [-65, -38], scale }}
      style={{ width: '100%', height: '100%' }}
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }: { geographies: any[] }) =>
          geographies.map((geo) => {
            const key = resolveProvince(geo.properties?.nombre ?? '')
            const count = callsByProvince[key] ?? 0
            const fill = variant === 'full' && count > 0
              ? callsToColor(count, maxCalls) + '55'
              : '#181818'
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={fill}
                stroke={variant === 'full' ? '#33333388' : '#2a2a2a'}
                strokeWidth={0.4}
                style={{ default: { outline: 'none' }, hover: { outline: 'none', opacity: 0.9 }, pressed: { outline: 'none' } }}
              />
            )
          })
        }
      </Geographies>

      {pins.map((pin) => {
        const r = getR(pin.total)
        const color = callsToColor(pin.total, maxPinCalls)
        const isHov = hoveredPin?.id === pin.id

        return (
          <Marker
            key={pin.id}
            coordinates={[pin.lon, pin.lat]}
            onMouseEnter={() => onHoverPin(pin)}
            onMouseLeave={() => onHoverPin(null)}
          >
            {isHov && <circle r={r + 5} fill="none" stroke={color} strokeWidth={1.5} opacity={0.5} />}
            <circle r={r} fill={color} stroke="#000000aa" strokeWidth={0.8} style={{ cursor: 'pointer' }} />
            {variant === 'full' && pin.total >= 3 && (
              <text y={-(r + 3)} textAnchor="middle"
                style={{ fontFamily: 'inherit', fontSize: '7px', fontWeight: 900, fill: '#ffffff99', pointerEvents: 'none', userSelect: 'none' }}>
                {pin.nombre.length > 14 ? pin.nombre.slice(0, 13) + '…' : pin.nombre}
              </text>
            )}
          </Marker>
        )
      })}
    </ComposableMap>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Ranking sidebar — used in the /mapa page
// ─────────────────────────────────────────────────────────────────────────────
interface RankingSidebarProps {
  pins: ConcesionarioPin[]
  maxPinCalls: number
  hoveredPin: ConcesionarioPin | null
  onHoverPin: (pin: ConcesionarioPin | null) => void
}

export function RankingSidebar({ pins, maxPinCalls, hoveredPin, onHoverPin }: RankingSidebarProps) {
  return (
    <div className="w-72 shrink-0 border-l border-neutral-800 flex flex-col overflow-hidden">
      <div className="px-6 py-5 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-red-600" />
          <span className="text-white font-black italic uppercase text-xs tracking-widest">Ranking Sucursales</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 px-6">
            <MapPin size={32} className="text-neutral-700" />
            <p className="text-neutral-600 text-xs font-black uppercase text-center">
              Asigná ciudades a los concesionarios para ver los puntos en el mapa
            </p>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {pins.map((pin, i) => {
              const isHov = hoveredPin?.id === pin.id
              const efic = pin.total > 0 ? Math.round((pin.atendidas / pin.total) * 100) : 0
              const barW = maxPinCalls > 0 ? Math.round((pin.total / maxPinCalls) * 100) : 0

              return (
                <div
                  key={pin.id}
                  onMouseEnter={() => onHoverPin(pin)}
                  onMouseLeave={() => onHoverPin(null)}
                  className={`flex flex-col gap-1.5 p-3 rounded-xl cursor-default transition-colors ${
                    isHov ? 'bg-red-600/10 border border-red-600/30' : 'border border-transparent hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-neutral-700 text-[9px] font-black w-4 text-right shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black italic uppercase text-xs truncate leading-none">{pin.nombre}</p>
                      <p className="text-neutral-600 text-[8px] font-black truncate mt-0.5">
                        {pin.ciudad}{pin.provincia ? `, ${pin.provincia}` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-white font-black italic text-base">{pin.total}</span>
                      <span className={`block text-[8px] font-black ${efic >= 80 ? 'text-green-400' : efic >= 60 ? 'text-yellow-400' : 'text-red-500'}`}>
                        {efic}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1 bg-neutral-800 rounded-full overflow-hidden ml-6">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${barW}%`, background: callsToColor(pin.total, maxPinCalls) }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {pins.length > 0 && (
        <div className="shrink-0 border-t border-neutral-800 px-6 py-4 flex justify-between">
          <div className="flex flex-col">
            <span className="text-white font-black italic text-xl">{pins.length}</span>
            <span className="text-neutral-600 text-[8px] font-black uppercase">Sucursales</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-white font-black italic text-xl">{pins.reduce((s, p) => s + p.total, 0)}</span>
            <span className="text-neutral-600 text-[8px] font-black uppercase">Llamadas</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ArgentinaMap — panel (mini) variant used in the wallboard
// ─────────────────────────────────────────────────────────────────────────────
interface Props {
  llamadas: LlamadaConConcesionario[]
}

export default function ArgentinaMap({ llamadas }: Props) {
  const [hoveredPin, setHoveredPin] = useState<ConcesionarioPin | null>(null)

  const pins = usePins(llamadas)
  const callsByProvince = useCallsByProvince(llamadas)
  const maxCalls = useMemo(() => Math.max(...Object.values(callsByProvince), 1), [callsByProvince])
  const maxPinCalls = useMemo(() => Math.max(...pins.map((p) => p.total), 1), [pins])

  const hasPins = pins.length > 0

  return (
    <div className="w-full h-full flex flex-col relative group">
      {/* Link to full map page */}
      <Link
        href="/mapa"
        className="absolute top-2 right-2 z-10 p-1.5 bg-neutral-900/80 border border-neutral-700 rounded-lg text-neutral-600 hover:text-white hover:border-red-600 transition-all opacity-0 group-hover:opacity-100"
        title="Ver mapa completo"
      >
        <Maximize2 size={11} />
      </Link>

      <div className="flex-1 min-h-0">
        <MapCanvas
          pins={pins}
          callsByProvince={callsByProvince}
          maxCalls={maxCalls}
          maxPinCalls={maxPinCalls}
          variant="mini"
          hoveredPin={hoveredPin}
          onHoverPin={setHoveredPin}
        />
      </div>

      {hasPins ? (
        <div className="shrink-0 px-3 pb-2 flex items-center gap-2">
          <span className="text-neutral-700 text-[7px] font-black uppercase">{pins.length} sucursales</span>
          <div className="flex-1 h-1 rounded-full" style={{ background: 'linear-gradient(to right, #ffffb2, #fd8d3c, #bd0026)' }} />
          <span className="text-neutral-700 text-[7px] font-black uppercase">{maxPinCalls} máx</span>
        </div>
      ) : (
        <div className="shrink-0 pb-2 flex justify-center">
          <span className="text-neutral-700 text-[8px] font-black uppercase tracking-widest">
            Sin coordenadas cargadas
          </span>
        </div>
      )}
    </div>
  )
}
