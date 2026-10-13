/**
 * Número nacional argentino de 10 dígitos, para comparar teléfonos que llegan
 * en distintos formatos (+543471343991, +5493471343991, 03471343991, 3471343991).
 *
 * Replica `public.normalizar_telefono()` de la base (migración 0009), que llena
 * la columna `numero_normalizado`. Si cambia una, cambiar la otra.
 */
export function normalizarTelefono(numero: string): string {
  const d = numero.replace(/\D/g, '')
  if (/^549\d{10}$/.test(d)) return d.slice(3)
  if (/^54\d{10}$/.test(d)) return d.slice(2)
  if (/^0\d{10}$/.test(d)) return d.slice(1)
  return d
}
