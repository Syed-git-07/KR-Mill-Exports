'use client'

import { useEffect, useRef } from 'react'

/**
 * Runs a server-data loader only when its actual server scope changes.
 *
 * The loader itself is kept in a ref so changes to client-only calculation
 * callbacks or shared draft objects do not accidentally trigger another
 * server request.
 */

export function useServerDataLoader(loadData, scopeValues = []) {
  const loaderRef = useRef(loadData)
  const scopeKey = JSON.stringify(scopeValues)

  useEffect(() => {
    loaderRef.current = loadData
  }, [loadData])

  useEffect(() => {
    loaderRef.current()
  }, [scopeKey])
}
