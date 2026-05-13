import type { Diff } from '../../shared/surface.ts'
import { NoteColumn } from './NoteColumn.tsx'
import { DiffView } from './DiffView.tsx'

interface Props {
  diff: Diff
}

export const ReviewRow = ({ diff }: Props) => {
  return (
    <div className="review-row">
      <NoteColumn annotations={diff.annotations} hunks={diff.hunks} />
      <DiffView diff={diff} />
    </div>
  )
}
