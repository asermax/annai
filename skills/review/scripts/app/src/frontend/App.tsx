import { useSurface } from './hooks/useSurface.ts'
import { SurfacePage } from './components/SurfacePage.tsx'
import { DraftsProvider } from './state/drafts.tsx'

export const App = () => {
  const result = useSurface()

  return (
    result.status === 'loading'
      ? <div className="status-banner">Loading surface…</div>
      : result.status === 'error'
        ? <div className="status-banner error">Failed to load surface: {result.error}</div>
        : (
          <DraftsProvider>
            <SurfacePage surface={result.surface!} />
          </DraftsProvider>
        )
  )
}
