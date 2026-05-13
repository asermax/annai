import type { Annotation, Hunk } from '../../shared/surface.ts'
import { Note } from './Note.tsx'

interface Props {
  annotations: Annotation[]
  hunks: Hunk[]
}

// Rough line-height (in px) for diff2html's table rows. Used to compute
// vertical offsets for notes that target a specific line range. Tuned to
// match the font-size 12.5px / line-height 1.5 of the diff body.
const LINE_HEIGHT_PX = 20
const DIFF_HEAD_PX = 36

interface NoteLayout {
  annotation: Annotation
  top: number
  height: number
}

const computeLineToOffset = (hunks: Hunk[]): Map<number, number> => {
  const map = new Map<number, number>()
  let yIdx = 0  // visual row index in the rendered diff (including hunk headers)

  for (const hunk of hunks) {
    // hunk header row
    yIdx += 1
    for (const line of hunk.lines) {
      if (line.newLine != null) {
        map.set(line.newLine, yIdx)
      }
      yIdx += 1
    }
  }

  return map
}

const layoutNotes = (annotations: Annotation[], hunks: Hunk[]): NoteLayout[] => {
  const lineMap = computeLineToOffset(hunks)
  const sorted = [...annotations].sort((a, b) => a.lineRange[0] - b.lineRange[0])

  const layouts: NoteLayout[] = []
  let prevBottom = 0

  for (const annotation of sorted) {
    const [start, end] = annotation.lineRange
    const startIdx = lineMap.get(start) ?? 0
    const endIdx = lineMap.get(end) ?? startIdx
    const naturalTop = DIFF_HEAD_PX + startIdx * LINE_HEIGHT_PX
    const naturalHeight = Math.max(36, (endIdx - startIdx + 1) * LINE_HEIGHT_PX)

    const top = Math.max(naturalTop, prevBottom + 6)
    const height = naturalHeight
    layouts.push({ annotation, top, height })
    prevBottom = top + height
  }

  return layouts
}

export const NoteColumn = ({ annotations, hunks }: Props) => {
  const layouts = layoutNotes(annotations, hunks)
  const totalHeight = layouts.length > 0
    ? Math.max(...layouts.map(l => l.top + l.height)) + 12
    : 120

  return (
    <div className="notes-col" style={{ height: totalHeight }}>
      {layouts.map(layout => (
        <Note
          key={layout.annotation.id}
          annotation={layout.annotation}
          top={layout.top}
        />
      ))}
    </div>
  )
}
