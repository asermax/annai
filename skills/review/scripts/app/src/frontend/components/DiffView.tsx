import { forwardRef, useCallback, useMemo } from 'react'

import { PatchDiff } from '@pierre/diffs/react'
import type { AnnotationSide, DiffLineAnnotation, SelectedLineRange } from '@pierre/diffs'

import type { Diff, Hunk } from '../../shared/surface.ts'
import type { DiffSide } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'
import { DraftComposer } from './DraftComposer.tsx'
import { DraftDisplay } from './DraftDisplay.tsx'
import { SuggestionBlock } from './SuggestionBlock.tsx'

interface Props {
  diff: Diff
}

type AnnotationMeta =
  | { kind: 'draft-pending' }
  | { kind: 'draft', draftId: string }
  | { kind: 'suggestion', suggestionId: string }

const toLibSide = (s: DiffSide): AnnotationSide => (s === 'RIGHT' ? 'additions' : 'deletions')
const toGitHubSide = (s: AnnotationSide | undefined): DiffSide => (s === 'deletions' ? 'LEFT' : 'RIGHT')

const pickSideForRange = (range: [number, number], hunks: Hunk[]): AnnotationSide => {
  const [, end] = range

  for (const hunk of hunks) {
    for (const line of hunk.lines) {
      if (line.kind === 'add' && line.newLine === end) return 'additions'
      if (line.kind === 'del' && line.oldLine === end) return 'deletions'
      if (line.kind === 'context' && line.newLine === end) return 'additions'
    }
  }

  return 'additions'
}

const hunkToUnified = (hunk: Hunk): string => {
  const lines = hunk.lines.map(l => {
    const prefix = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '
    return prefix + l.content
  })

  return [hunk.header, ...lines].join('\n')
}

const buildUnifiedDiff = (diff: Diff): string => {
  const header = `--- a/${diff.path}\n+++ b/${diff.path}\n`
  return header + diff.hunks.map(hunkToUnified).join('\n') + '\n'
}

export const DiffView = forwardRef<HTMLDivElement, Props>(({ diff }, ref) => {
  const drafts = useDrafts()

  const unified = useMemo(() => buildUnifiedDiff(diff), [diff])

  const fileLineDrafts = useMemo(
    () => drafts.drafts.filter(d => d.path === diff.path && (d.kind === 'line' || d.kind === 'range')),
    [drafts.drafts, diff.path],
  )

  const draftsById = useMemo(
    () => new Map(fileLineDrafts.map(d => [d.id, d])),
    [fileLineDrafts],
  )

  const suggestionsById = useMemo(
    () => new Map(diff.suggestions.map(s => [s.id, s])),
    [diff.suggestions],
  )

  const lineAnnotations = useMemo<DiffLineAnnotation<AnnotationMeta>[]>(() => {
    const out: DiffLineAnnotation<AnnotationMeta>[] = []

    // saved line/range drafts — anchored at the end line
    for (const d of fileLineDrafts) {
      const endLine = d.kind === 'line' ? d.line : d.line
      out.push({
        side: toLibSide(d.side),
        lineNumber: endLine,
        metadata: { kind: 'draft', draftId: d.id },
      })
    }

    // suggestions from the agent surface (accept / dismiss candidates)
    for (const sugg of diff.suggestions) {
      if (drafts.resolvedSuggestionIds.includes(sugg.id)) continue

      const side = pickSideForRange(sugg.lineRange, diff.hunks)
      out.push({
        side,
        lineNumber: sugg.lineRange[1],
        metadata: { kind: 'suggestion', suggestionId: sugg.id },
      })
    }

    // active composer anchor (only one at a time, only if it's for this file)
    const a = drafts.activeAnchor
    if (a != null && a.path === diff.path) {
      out.push({
        side: toLibSide(a.side),
        lineNumber: a.line,
        metadata: { kind: 'draft-pending' },
      })
    }

    return out
  }, [fileLineDrafts, diff, drafts.activeAnchor])

  const handleGutterClick = useCallback((range: SelectedLineRange) => {
    const startSide = toGitHubSide(range.side as AnnotationSide | undefined)
    const endSide = toGitHubSide((range.endSide ?? range.side) as AnnotationSide | undefined)

    if (range.start === range.end) {
      drafts.openAnchor({ kind: 'line', path: diff.path, line: range.end, side: endSide })
    } else {
      drafts.openAnchor({
        kind: 'range',
        path: diff.path,
        startLine: range.start,
        startSide,
        line: range.end,
        side: endSide,
      })
    }
  }, [diff.path, drafts])

  const renderAnnotation = useCallback((anno: DiffLineAnnotation<AnnotationMeta>) => {
    const m = anno.metadata
    if (m == null) return null

    if (m.kind === 'draft') {
      const draft = draftsById.get(m.draftId)
      return draft != null ? <DraftDisplay draft={draft} /> : null
    }

    if (m.kind === 'draft-pending') {
      const a = drafts.activeAnchor
      return a != null ? <DraftComposer anchor={a} /> : null
    }

    if (m.kind === 'suggestion') {
      const sugg = suggestionsById.get(m.suggestionId)
      if (sugg == null) return null
      const side: DiffSide = anno.side === 'additions' ? 'RIGHT' : 'LEFT'
      return (
        <SuggestionBlock
          suggestion={sugg}
          path={diff.path}
          side={side}
        />
      )
    }

    return null
  }, [draftsById, suggestionsById, drafts.activeAnchor, diff.path])

  return (
    <div className="diff" ref={ref}>
      <div className="diff-head">
        <span className="path">{diff.path}</span>
      </div>
      <div className="diff-body">
        <PatchDiff<AnnotationMeta>
          patch={unified}
          options={{
            diffStyle: 'unified',
            enableLineSelection: true,
            enableGutterUtility: true,
            onGutterUtilityClick: handleGutterClick,
          }}
          lineAnnotations={lineAnnotations}
          renderAnnotation={renderAnnotation}
          renderGutterUtility={() => <span className="gutter-utility" aria-label="add comment">+</span>}
          disableWorkerPool
        />
      </div>
    </div>
  )
})

DiffView.displayName = 'DiffView'
