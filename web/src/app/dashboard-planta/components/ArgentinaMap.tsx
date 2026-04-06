'use client'

import React, { useMemo, memo, useCallback } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import type { LlamadaConConcesionario } from '@/types/domain'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ConcesionarioPin {
  id: string
  nombre: string
  ciudad: string
  provincia: string
  lat: number
  lng: number
  total: number
  atendidas: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

export function usePins(llamadas: LlamadaConConcesionario[]): ConcesionarioPin[] {
  return useMemo(() => {
    const map = new Map<string, ConcesionarioPin>()
    for (const l of llamadas) {
      const c = l.concesionarios
      if (!c || c.latitud == null || c.longitud == null) continue
      const key = c.nombre
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nombre: c.nombre,
          ciudad: c.ciudad ?? '',
          provincia: c.provincia ?? '',
          lat: c.latitud,
          lng: c.longitud,
          total: 0,
          atendidas: 0,
        })
      }
      const pin = map.get(key)!
      pin.total++
      if (l.estado?.toUpperCase() === 'ATENDIDA') pin.atendidas++
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [llamadas])
}

export function useCallsByProvince(llamadas: LlamadaConConcesionario[]): Record<string, number> {
  return useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of llamadas) {
      const prov = l.concesionarios?.provincia
      if (!prov) continue
      const key = normalizeStr(prov)
      counts[key] = (counts[key] ?? 0) + 1
    }
    return counts
  }, [llamadas])
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function normalizeStr(str: string): string {
  return str.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Maps a call count to a heat color in the range #ffffb2 → #fd8d3c → #bd0026. */
export function callsToColor(count: number, max: number): string {
  if (count === 0 || max === 0) return '#171717'
  const t = count / max
  if (t < 0.5) {
    const t2 = t * 2
    const r = Math.round(255 + (253 - 255) * t2)
    const g = Math.round(255 + (141 - 255) * t2)
    const b = Math.round(178 + (60  - 178) * t2)
    return `rgb(${r},${g},${b})`
  }
  const t2 = (t - 0.5) * 2
  const r = Math.round(253 + (189 - 253) * t2)
  const g = Math.round(141 + (0   - 141) * t2)
  const b = Math.round(60  + (38  -  60) * t2)
  return `rgb(${r},${g},${b})`
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GEO_URL =
  'https://raw.githubusercontent.com/datasets/geo-boundaries-world/master/countries/ARG/provinces.json'

// ─────────────────────────────────────────────────────────────────────────────
// MapCanvas
// ─────────────────────────────────────────────────────────────────────────────

interface MapCanvasProps {
  pins: ConcesionarioPin[]
  callsByProvince: Record<string, number>
  maxCalls: number
  maxPinCalls: number
  variant?: 'full' | 'mini'
  hoveredPin: ConcesionarioPin | null
  onHoverPin: (pin: ConcesionarioPin | null) => void
  mapScale?: number
  mapCenter?: [number, number]
}

export const MapCanvas = memo(function MapCanvas({
  pins,
  callsByProvince,
  maxCalls,
  maxPinCalls,
  variant = 'full',
  hoveredPin,
  onHoverPin,
  mapScale = 750,
  mapCenter = [-63, -40],
}: MapCanvasProps) {
  const pinRadius = useCallback(
    (total: number) => {
      const minR = variant === 'full' ? 4 : 2
      const maxR = variant === 'full' ? 16 : 8
      return minR + (total / Math.max(maxPinCalls, 1)) * (maxR - minR)
    },
    [maxPinCalls, variant],
  )

  return (
    <ComposableMap
      projection="geoMercator"
      projectionConfig={{ scale: mapScale, center: mapCenter }}
      style={{ width: '100%', height: '100%' }}
    >
      <Geographies geography={GEO_URL}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const provName = normalizeStr(
              geo.properties.name || geo.properties.NAME_1 || '',
            )
            const count = callsByProvince[provName] ?? 0
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={callsToColor(count, maxCalls)}
                stroke="#262626"
                strokeWidth={0.5}
                style={{
                  default: { outline: 'none' },
                  hover:   { fill: '#444', outline: 'none', cursor: 'default' },
                  pressed: { outline: 'none' },
                }}
              />
            )
          })
        }
      </Geographies>

      {pins.map((pin) => {
        const r = pinRadius(pin.total)
        const isHovered = hoveredPin?.id === pin.id
        return (
          <Marker
            key={pin.id}
            coordinates={[pin.lng, pin.lat]}
            onMouseEnter={() => onHoverPin(pin)}
            onMouseLeave={() => onHoverPin(null)}
          >
            <circle
              r={isHovered ? r + 3 : r}
              fill={isHovered ? '#ffffff' : '#fd8d3c'}
              fillOpacity={isHovered ? 0.95 : 0.8}
              stroke={isHovered ? '#ffffff' : '#fd8d3c'}
              strokeWidth={isHovered ? 2 : 1}
              strokeOpacity={0.5}
              style={{ cursor: 'pointer', transition: 'r 0.2s, fill 0.2s' }}
            />
          </Marker>
        )
      })}
    </ComposableMap>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// RankingSidebar
// ─────────────────────────────────────────────────────────────────────────────

interface RankingSidebarProps {
  pins: ConcesionarioPin[]
  maxPinCalls: number
  hoveredPin: ConcesionarioPin | null
  onHoverPin: (pin: ConcesionarioPin | null) => void
}

export const RankingSidebar = memo(function RankingSidebar({
  pins,
  maxPinCalls,
  hoveredPin,
  onHoverPin,
}: RankingSidebarProps) {
  const top = pins.slice(0, 20)

  return (
    <aside className="w-64 shrink-0 border-l border-neutral-800 bg-black/40 flex flex-col">
      <div className="px-5 py-4 border-b border-neutral-800 shrink-0">
        <p className="text-neutral-500 text-[8px] font-black uppercase tracking-widest">
          Ranking por llamadas
        </p>
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 p-3">
        {top.map((pin, i) => {
          const isHovered = hoveredPin?.id === pin.id
          const pct = Math.round((pin.total / Math.max(maxPinCalls, 1)) * 100)
          return (
            <div
              key={pin.id}
              onMouseEnter={() => onHoverPin(pin)}
              onMouseLeave={() => onHoverPin(null)}
              className={`p-2.5 rounded-xl cursor-pointer transition-all duration-150 border ${
                isHovered
                  ? 'bg-neutral-800 border-neutral-600'
                  : 'border-transparent hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-neutral-600 text-[9px] font-black w-4 shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-white text-[10px] font-black uppercase truncate">
                    {pin.nombre}
                  </span>
                </div>
                <span className="text-white font-black text-sm italic shrink-0 ml-2">
                  {pin.total}
                </span>
              </div>
              <div className="h-1 bg-neutral-800 rounded-full overflow-hidden ml-6">
                <div
                  className="h-full bg-red-600 rounded-full transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </aside>
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// Default export
// ─────────────────────────────────────────────────────────────────────────────

export default MapCanvas
