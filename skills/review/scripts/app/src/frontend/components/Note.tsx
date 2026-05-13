import { useEffect, useMemo, useRef } from 'react'
import { marked } from 'marked'
import type { Annotation } from '../../shared/surface.ts'

interface Props {
  annotation: Annotation
  collapsed: boolean
  marginTop: number
  naturalHeight: number | null
  collapsedHeight: number
  onToggle: () => void
  onNaturalHeightChange: (height: number) => void
}

const KIND_LABEL: Record<string, string> = {
  pattern: 'Pattern',
  note: 'Note',
  question: 'Question',
  'surface-check': 'Surface check',
  discrepancy: 'Discrepancy',
}

export const Note = ({
  annotation,
  collapsed,
  marginTop,
  naturalHeight,
  collapsedHeight,
  onToggle,
  onNaturalHeightChange,
}: Props) => {
  const innerRef = useRef<HTMLDivElement | null>(null)

  // Keep an up-to-date ref so the ResizeObserver (created once) can read the
  // current collapsed state without being recreated on every toggle.
  const collapsedRef = useRef(collapsed)
  collapsedRef.current = collapsed

  const bodyHtml = useMemo(
    () => marked.parse(annotation.body, { async: false }) as string,
    [annotation.body],
  )

  useEffect(() => {
    const el = innerRef.current
    if (el == null) return

    const observer = new ResizeObserver(() => {
      // Only report height while expanded — when the user collapses, .title and
      // .body get display:none and the inner shrinks; we don't want to overwrite
      // the cached natural height with the collapsed value.
      if (collapsedRef.current) return
      onNaturalHeightChange(el.offsetHeight)
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [onNaturalHeightChange])

  const lineRange = annotation.lineRange[1] !== annotation.lineRange[0]
    ? `L${annotation.lineRange[0]}–${annotation.lineRange[1]}`
    : `L${annotation.lineRange[0]}`

  const height = collapsed ? collapsedHeight : (naturalHeight ?? 'auto')

  return (
    <div
      className={`note kind-${annotation.kind} ${collapsed ? 'collapsed' : ''}`}
      style={{ marginTop, height }}
      onClick={onToggle}
    >
      <div className="note-inner" ref={innerRef}>
        <div className="head">
          <span className="kind">{KIND_LABEL[annotation.kind] ?? annotation.kind}</span>
          <span className="lines">{lineRange}</span>
        </div>
        <div className="title">{annotation.title}</div>
        <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </div>
  )
}
