import { useEffect, useRef, useState } from 'react'
import type { MermaidDiagram as DiagramType } from '../../shared/surface.ts'

interface Props {
  diagram: DiagramType
}

let mermaidInitDone = false

export const MermaidDiagram = ({ diagram }: Props) => {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const render = async (): Promise<void> => {
      try {
        const mod = await import('mermaid')
        const mermaid = mod.default

        if (!mermaidInitDone) {
          mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'strict' })
          mermaidInitDone = true
        }

        const { svg } = await mermaid.render(`mermaid-${diagram.id}-${Math.random().toString(36).slice(2)}`, diagram.source)
        if (cancelled) return
        if (hostRef.current != null) hostRef.current.innerHTML = svg
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setError(message)
        }
      }
    }

    void render()

    return () => { cancelled = true }
  }, [diagram.id, diagram.source])

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
