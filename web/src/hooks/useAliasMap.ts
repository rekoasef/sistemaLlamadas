'use client'

import { useState, useEffect } from 'react'
import { fetchAliasMap } from '@/services/alias.service'
import type { AliasMap } from '@/types/domain'

interface UseAliasMapReturn {
  aliasMap: AliasMap
  loadingAliases: boolean
}

/**
 * Loads the device alias map once on mount.
 *
 * The alias map is a stable in-memory record of dispositivo_id → human name.
 * Fetching it separately from llamadas avoids a JOIN on the realtime-sensitive
 * llamadas query, which would re-execute on every Postgres change event.
 */
export function useAliasMap(): UseAliasMapReturn {
  const [aliasMap, setAliasMap] = useState<AliasMap>({})
  const [loadingAliases, setLoadingAliases] = useState(true)

  useEffect(() => {
    fetchAliasMap()
      .then(setAliasMap)
      .catch(console.error)
      .finally(() => setLoadingAliases(false))
  }, [])

  return { aliasMap, loadingAliases }
}
