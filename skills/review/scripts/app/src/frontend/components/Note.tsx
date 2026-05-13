import { useState } from 'react'
import { marked } from 'marked'
import type { Annotation } from '../../shared/surface.ts'

interface Props {
  annotation: Annotation
  top: number
}

const KIND_LABEL: Record<string, string> = {
  pattern: 'Pattern',
  note: 'Note',
  question: 'Question',
  'surface-check': 'Surface check',
  discrepancy: 'Discrepancy',
}

export const Note = ({ annotation, top }: Props) => {
  const [expanded, setExpanded] = useState(false)
  const bodyHtml = marked.parse(annotation.body, { async: false }) as string

  return (
    <div
      className={`note kind-${annotation.kind} ${expanded ? 'expanded' : 'collapsed'}`}
      style={{ top }}
      onClick={() => setExpanded(prev => !prev)}
    >
      <div className="head">
        <span className="kind">{KIND_LABEL[annotation.kind] ?? annotation.kind}</span>
        <span className="lines">L{annotation.lineRange[0]}{annotation.lineRange[1] !== annotation.lineRange[0] ? `–${annotation.lineRange[1]}` : ''}</span>
      </div>
      <div className="title">{annotation.title}</div>
      <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </div>
  )
}
