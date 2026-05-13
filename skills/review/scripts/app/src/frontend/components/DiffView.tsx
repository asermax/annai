import { forwardRef, useMemo } from 'react'
import { PatchDiff } from '@pierre/diffs/react'
import type { Diff, Hunk } from '../../shared/surface.ts'
import { SuggestionBlock } from './SuggestionBlock.tsx'

interface Props {
  diff: Diff
}

const hunkToUnified = (hunk: Hunk): string => {
  const lines = hunk.lines.map(line => {
    const prefix = line.kind === 'add' ? '+' : line.kind === 'del' ? '-' : ' '
    return prefix + line.content
  })

  return [hunk.header, ...lines].join('\n')
}

const buildUnifiedDiff = (diff: Diff): string => {
  const header = `--- a/${diff.path}\n+++ b/${diff.path}\n`
  const body = diff.hunks.map(hunkToUnified).join('\n')

  return header + body + '\n'
}

export const DiffView = forwardRef<HTMLDivElement, Props>(({ diff }, ref) => {
  const unified = useMemo(() => buildUnifiedDiff(diff), [diff])

  return (
    <div className="diff" ref={ref}>
      <div className="diff-head">
        <span className="path">{diff.path}</span>
      </div>
      <div className="diff-body">
        <PatchDiff patch={unified} disableWorkerPool />
      </div>
      {diff.suggestions.map(suggestion => (
        <SuggestionBlock key={suggestion.id} suggestion={suggestion} />
      ))}
    </div>
  )
})

DiffView.displayName = 'DiffView'
