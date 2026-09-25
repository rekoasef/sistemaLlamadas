/** Supabase (PostgREST max_rows) devuelve como máximo 1000 filas por request,
 *  sin importar el .limit() — por eso se pagina. */
const PAGE_SIZE = 1000

type PageQuery = {
  range(
    from: number,
    to: number
  ): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
}

/**
 * Trae todas las filas de una query paginando de a PAGE_SIZE.
 * `build` debe devolver una query nueva en cada llamada y con orden estable
 * (desempate por id) para que las páginas no se pisen.
 */
export async function fetchAllPages<T>(build: () => PageQuery, label: string): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await build().range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const page = (data ?? []) as T[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}
