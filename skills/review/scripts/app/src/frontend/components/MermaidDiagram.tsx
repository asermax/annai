import { useEffect, useRef, useState } from 'react'
import type { MermaidDiagram as DiagramType } from '../../shared/surface.ts'

interface Props {
  diagram: DiagramType
}

type Theme = 'light' | 'dark'

const readTheme = (): Theme => (
  document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
)

const useTheme = (): Theme => {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => observer.disconnect()
  }, [])

  return theme
}

export const MermaidDiagram = ({ diagram }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const theme = useTheme()

  useEffect(() => {
    let cancelled = false

    const render = async (): Promise<void> => {
      try {
        const mod = await import('mermaid')
        const mermaid = mod.default

        // initialize is idempotent — re-call to pick up theme changes
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'neutral',
          securityLevel: 'strict',
        })

        const { svg } = await mermaid.render(`mermaid-${diagram.id}-${Math.random().toString(36).slice(2)}`, diagram.source)
        if (cancelled) return
        if (hostRef.current != null) hostRef.current.innerHTML = svg
        setError(null)
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
        }
      }
    }

    void render()

    return () => { cancelled = true }
  }, [diagram.id, diagram.source, theme])

  return (
    <div className="diagram" id={diagram.id}>
      {diagram.title != null ? <div className="diagram-label">{diagram.title}</div> : null}
      {error != null ? (
        <div className="status-banner error">mermaid render failed: {error}</div>
      ) : (
        <div className="mermaid-host" ref={hostRef} />
      )}
    </div>
  )
}
