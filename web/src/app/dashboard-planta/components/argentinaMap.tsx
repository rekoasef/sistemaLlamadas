'use client'

import React, { useMemo, memo } from 'react'
import { ComposableMap, Geographies, Geography } from "react-simple-maps"
import { scaleLinear } from "d3-scale"

// URL con la geometría de provincias argentinas (TopoJSON/GeoJSON)
const GEO_URL = "https://raw.githubusercontent.com/datasets/geo-boundaries-world/master/countries/ARG/provinces.json"

interface ArgentinaMapProps {
  llamadas: any[]
}

const ArgentinaMap = memo(function ArgentinaMap({ llamadas }: ArgentinaMapProps) {
  // Función para normalizar nombres (quita acentos y pone en mayúsculas)
  const normalize = (str: string) => 
    str ? str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ""

  // Agrupamos llamadas por provincia para el calor
  const statsProvincias = useMemo(() => {
    const counts: Record<string, number> = {}
    llamadas.forEach(l => {
      // Ajustamos el acceso según tu estructura de datos (l.concesionarios o l.concesionario)
      const prov = normalize(l.concesionarios?.provincia || l.provincia || "")
      if (prov) counts[prov] = (counts[prov] || 0) + 1
    })
    return counts
  }, [llamadas])

  const maxVal = useMemo(() => {
    const values = Object.values(statsProvincias)
    return values.length > 0 ? Math.max(...values) : 1
  }, [statsProvincias])

  // Escala: Gris oscuro (0) -> Amarillo (Bajo) -> Rojo Crucianelli (Alto)
  const colorScale = scaleLinear<string>()
    .domain([0, 1, maxVal])
    .range(["#171717", "#facc15", "#dc2626"])

  return (
    <div className="relative h-full w-full flex flex-col p-4 overflow-hidden">
      <div className="flex justify-between items-start z-10">
        <div>
          <p className="text-red-600 text-[10px] font-black uppercase tracking-widest italic leading-none">Heatmap Federal</p>
          <p className="text-neutral-500 text-[8px] uppercase font-bold mt-1">Distribución de llamados</p>
        </div>
        {/* Leyenda simple */}
        <div className="flex gap-1">
          <div className="w-2 h-2 rounded-full bg-yellow-400 opacity-50" />
          <div className="w-2 h-2 rounded-full bg-red-600" />
        </div>
      </div>

      <div className="flex-1 -mt-4">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 750, center: [-63, -40] }}
          style={{ width: "100%", height: "100%" }}
        >
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => {
                // Nominatim y datasets suelen usar 'name' o 'NAME_1'
                const provName = normalize(geo.properties.name || geo.properties.NAME_1 || "")
                const count = statsProvincias[provName] || 0
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={colorScale(count)}
                    stroke="#262626"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { fill: "#444", outline: "none", cursor: "pointer" },
                      pressed: { outline: "none" }
                    }}
                  />
                )
              })
            }
          </Geographies>
        </ComposableMap>
      </div>
    </div>
  )
})

export default ArgentinaMap