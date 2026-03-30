/**
 * Geocoding service — powered by the Argentine government's free georef API.
 * Endpoint: https://apis.datos.gob.ar/georef/api/
 *
 * No API key required. No rate limits for reasonable usage.
 * Returns Argentine localidades with province, department, and centroid.
 */

const GEOREF_BASE = 'https://apis.datos.gob.ar/georef/api'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface LocalidadSugerencia {
  nombre: string
  provincia: string
  lat: number
  lon: number
  fullLabel: string // "Nombre, Provincia"
}

interface GeorefLocalidad {
  id: string
  nombre: string
  provincia: { id: string; nombre: string }
  departamento: { id: string; nombre: string }
  centroide: { lat: number; lon: number }
}

interface GeorefResponse {
  localidades: GeorefLocalidad[]
  cantidad: number
  total: number
  inicio: number
  parametros: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Public functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search Argentine localities by name. Returns up to `limit` suggestions.
 * Ideal for autocomplete inputs — call on each keystroke (debounced by caller).
 */
export async function buscarLocalidades(
  query: string,
  limit = 6
): Promise<LocalidadSugerencia[]> {
  if (!query || query.trim().length < 2) return []

  const params = new URLSearchParams({
    nombre: query.trim(),
    max: String(limit),
    campos: 'nombre,provincia,departamento,centroide',
    orden: 'nombre',
  })

  console.log(`[geocoding] Buscando localidades: "${query}"`)

  try {
    const res = await fetch(`${GEOREF_BASE}/localidades?${params}`)
    if (!res.ok) {
      console.warn(`[geocoding] Error HTTP ${res.status}`)
      return []
    }

    const data: GeorefResponse = await res.json()
    console.log(`[geocoding] Encontradas: ${data.cantidad} localidades`)

    return data.localidades.map((loc) => ({
      nombre: loc.nombre,
      provincia: loc.provincia.nombre,
      lat: loc.centroide.lat,
      lon: loc.centroide.lon,
      fullLabel: `${loc.nombre}, ${loc.provincia.nombre}`,
    }))
  } catch (err) {
    console.error('[geocoding] Error en buscarLocalidades:', err)
    return []
  }
}

/**
 * Resolve a single city+province string to coordinates.
 * Returns null if not found.
 */
export async function geocodificarCiudad(
  ciudad: string,
  provincia?: string
): Promise<{ lat: number; lon: number; provinciaCanonica: string } | null> {
  const params = new URLSearchParams({
    nombre: ciudad.trim(),
    max: '1',
    campos: 'nombre,provincia,centroide',
  })

  if (provincia) {
    params.set('provincia', provincia.trim())
  }

  console.log(`[geocoding] Geocodificando: "${ciudad}"${provincia ? `, Prov: "${provincia}"` : ''}`)

  try {
    const res = await fetch(`${GEOREF_BASE}/localidades?${params}`)
    if (!res.ok) return null

    const data: GeorefResponse = await res.json()
    if (!data.localidades.length) {
      console.warn(`[geocoding] Sin resultados para "${ciudad}"`)
      return null
    }

    const loc = data.localidades[0]
    console.log(`[geocoding] Resultado: ${loc.nombre}, ${loc.provincia.nombre} → ${loc.centroide.lat}, ${loc.centroide.lon}`)

    return {
      lat: loc.centroide.lat,
      lon: loc.centroide.lon,
      provinciaCanonica: loc.provincia.nombre,
    }
  } catch (err) {
    console.error('[geocoding] Error en geocodificarCiudad:', err)
    return null
  }
}
