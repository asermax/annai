import { useState } from 'react'
import type { Diff } from '../../shared/surface.ts'
import { NoteColumn } from './NoteColumn.tsx'
import { DiffView } from './DiffView.tsx'

interface Props {
  diff: Diff
}

export const ReviewRow = ({ diff }: Props) => {
  // Callback ref into state so NoteColumn's effect re-runs once DiffView is
  // mounted. A plain useRef won't work — NoteColumn commits before DiffView
  // (JSX order), so a shared ref would be null during NoteColumn's first
  // effect and the ref-object identity never changes to wake it up later.
  const [diffHost, setDiffHost] = useState<HTMLDivElement | null>(null)

  return (
    <div className="review-row">
      <NoteColumn annotations={diff.annotations} hunks={diff.hunks} diffHost={diffHost} />
      <DiffView ref={setDiffHost} diff={diff} />
    </div>
  )
}
