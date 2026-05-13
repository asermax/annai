import { useEffect, useState } from 'react'
import { surfaceSchema } from '../../shared/surface.ts'
import type { Surface } from '../../shared/surface.ts'

export interface UseSurfaceResult {
  status: 'loading' | 'ready' | 'error'
  surface: Surface | null
  error: string | null
}

export const useSurface = (): UseSurfaceResult => {
  const [result, setResult] = useState<UseSurfaceResult>({ status: 'loading', surface: null, error: null })

  useEffect(() => {
    let cancelled = false

    const load = async (): Promise<void> => {
      try {
        const response = await fetch('/api/surface', { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error(`/api/surface returned ${response.status}`)
        const raw: unknown = await response.json()
        const surface = surfaceSchema.parse(raw)
        if (!cancelled) setResult({ status: 'ready', surface, error: null })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setResult({ status: 'error', surface: null, error: message })
        }
      }
    }

    void load()

    return () => { cancelled = true }
  }, [])

  return result
}
