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
  // Three visual states, matching the v04 prototype:
  //   default — head + body visible, max-height 320px
  //   collapsed — chip with just kind/lines/title (~30px), body hidden
  //   expanded — body visible at full height (up to 800px), highlighted
  // The default is the resting state; clicking cycles default → collapsed → default.
  // (v0.1 doesn't auto-bunch overlapping notes; that's a v0.2 concern.)
  const [collapsed, setCollapsed] = useState(false)
  const bodyHtml = marked.parse(annotation.body, { async: false }) as string

  return (
    <div
      className={`note kind-${annotation.kind} ${collapsed ? 'collapsed' : ''}`}
      style={{ top }}
      onClick={() => setCollapsed(prev => !prev)}
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
