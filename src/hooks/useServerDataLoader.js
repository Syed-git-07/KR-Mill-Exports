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
  const requestedVersionRef = useRef(0)
  const runningRef = useRef(false)
  const mountedRef = useRef(true)
  const scopeKey = JSON.stringify(scopeValues)

  useEffect(() => {
    loaderRef.current = loadData
  }, [loadData])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    requestedVersionRef.current += 1

    const runLatest = async () => {
      if (runningRef.current || !mountedRef.current) return
      runningRef.current = true

      while (mountedRef.current) {
        const runningVersion = requestedVersionRef.current
        try {
          await loaderRef.current()
        } catch (error) {
          // Loaders normally surface their own UI error. Keep this final guard so
          // an unexpected rejection does not prevent the newest scope loading.
          console.error('Server data loader failed:', error)
        }

        if (runningVersion === requestedVersionRef.current) break
      }

      runningRef.current = false
    }

    runLatest()
  }, [scopeKey])
}
