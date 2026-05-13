import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { Annotation, Hunk } from '../../shared/surface.ts'
import { Note } from './Note.tsx'

interface Props {
  annotations: Annotation[]
  hunks: Hunk[]
  diffHost: HTMLDivElement | null
}

interface NoteLayout {
  annotation: Annotation
  marginTop: number
}

const COLLAPSED_HEIGHT_PX = 32
const NOTE_GAP_PX = 6

type Side = 'additions' | 'deletions'

const pickSide = (annotation: Annotation, hunks: Hunk[]): Side => {
  const [start, end] = annotation.lineRange

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add' && line.newLine != null && line.newLine >= start && line.newLine <= end) {
        return 'additions'
      }
    }
  }

  return 'deletions'
}

// @pierre/diffs renders the diff inside one or more <diffs-container> custom
// elements with an open shadow root. Each rendered code line carries
// data-line="<N>". In split mode there are two [data-content] columns
// (deletions left, additions right), each containing its own line. Scope by
// side; in unified mode there's only one column so side is moot.
const findLineElement = (
  diffHost: HTMLElement,
  lineNumber: number,
  side: Side,
): HTMLElement | null => {
  for (const el of Array.from(diffHost.querySelectorAll<HTMLElement>('*'))) {
    const root = el.shadowRoot
    if (root == null) continue

    const pre = root.querySelector<HTMLElement>('[data-diff]')
    if (pre == null) continue

    const isSplit = pre.getAttribute('data-diff-type') === 'split'
    const contents = Array.from(pre.querySelectorAll<HTMLElement>('[data-content]'))
    const target = isSplit
      ? (side === 'additions' ? contents[1] : contents[0])
      : contents[0]
    if (target == null) continue

    const line = target.querySelector<HTMLElement>(`[data-line="${lineNumber}"]`)
    if (line != null) return line
  }

  return null
}

interface AnchorMeasurement {
  annotation: Annotation
  anchorY: number
}

const measureAnchors = (
  annotations: Annotation[],
  hunks: Hunk[],
  diffHost: HTMLElement,
  notesCol: HTMLElement,
): AnchorMeasurement[] => {
  const notesTop = notesCol.getBoundingClientRect().top
  const out: AnchorMeasurement[] = []

  for (const annotation of annotations) {
    const side = pickSide(annotation, hunks)
    const line = findLineElement(diffHost, annotation.lineRange[0], side)
    if (line == null) continue

    out.push({
      annotation,
      anchorY: line.getBoundingClientRect().top - notesTop,
    })
  }

  // Sort by anchor y so flow order matches reading order.
  out.sort((a, b) => a.anchorY - b.anchorY)
  return out
}

const layoutNotes = (
  anchors: AnchorMeasurement[],
  collapseState: Map<string, boolean>,
  naturalHeights: Map<string, number>,
): NoteLayout[] => {
  const layouts: NoteLayout[] = []
  let y = 0
  let first = true

  for (const { annotation, anchorY } of anchors) {
    const gap = first ? 0 : NOTE_GAP_PX
    const desired = Math.max(y + gap, anchorY)
    const marginTop = desired - y
    layouts.push({ annotation, marginTop })

    const collapsed = collapseState.get(annotation.id) ?? false
    const height = collapsed
      ? COLLAPSED_HEIGHT_PX
      : (naturalHeights.get(annotation.id) ?? COLLAPSED_HEIGHT_PX)

    y = desired + height
    first = false
  }

  return layouts
}

export const NoteColumn = ({ annotations, hunks, diffHost }: Props) => {
  const notesColRef = useRef<HTMLDivElement | null>(null)
  const [layouts, setLayouts] = useState<NoteLayout[]>([])
  const [collapseState, setCollapseState] = useState<Map<string, boolean>>(() => new Map())
  const [naturalHeights, setNaturalHeights] = useState<Map<string, number>>(() => new Map())

  const toggleCollapsed = useCallback((id: string) => {
    setCollapseState(prev => {
      const next = new Map(prev)
      next.set(id, !(prev.get(id) ?? false))
      return next
    })
  }, [])

  const reportNaturalHeight = useCallback((id: string, height: number) => {
    setNaturalHeights(prev => {
      if (prev.get(id) === height) return prev
      const next = new Map(prev)
      next.set(id, height)
      return next
    })
  }, [])

  useLayoutEffect(() => {
    const notesCol = notesColRef.current
    if (diffHost == null || notesCol == null) return

    let pending: number | null = null
    const recompute = () => {
      if (pending != null) cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => {
        pending = null
        const anchors = measureAnchors(annotations, hunks, diffHost, notesCol)
        setLayouts(layoutNotes(anchors, collapseState, naturalHeights))
      })
    }

    // Sync first pass so initial paint isn't a 0-margin flash.
    setLayouts(layoutNotes(
      measureAnchors(annotations, hunks, diffHost, notesCol),
      collapseState,
      naturalHeights,
    ))

    const observer = new ResizeObserver(recompute)
    observer.observe(diffHost)

    return () => {
      observer.disconnect()
      if (pending != null) cancelAnimationFrame(pending)
    }
  }, [annotations, hunks, diffHost, collapseState, naturalHeights])

  return (
    <div className="notes-col" ref={notesColRef}>
      {layouts.map(({ annotation, marginTop }) => (
        <Note
          key={annotation.id}
          annotation={annotation}
          collapsed={collapseState.get(annotation.id) ?? false}
          marginTop={marginTop}
          naturalHeight={naturalHeights.get(annotation.id) ?? null}
          collapsedHeight={COLLAPSED_HEIGHT_PX}
          onToggle={() => toggleCollapsed(annotation.id)}
          onNaturalHeightChange={h => reportNaturalHeight(annotation.id, h)}
        />
      ))}
    </div>
  )
}
