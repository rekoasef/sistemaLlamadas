/**
 * Límites de un día calendario argentino (`YYYY-MM-DD`) como timestamps ISO.
 *
 * Sin offset explícito Postgres interpreta `2026-10-05T23:59:59` en UTC, y el
 * día queda corrido 3 horas (incluye 21–24 h del día anterior y pierde 21–24 h
 * del propio). Argentina no tiene horario de verano, así que el offset es fijo.
 */
const AR_OFFSET = '-03:00'

export function inicioDiaAR(fecha: string): string {
  return `${fecha}T00:00:00${AR_OFFSET}`
}

export function finDiaAR(fecha: string): string {
  return `${fecha}T23:59:59.999${AR_OFFSET}`
}
