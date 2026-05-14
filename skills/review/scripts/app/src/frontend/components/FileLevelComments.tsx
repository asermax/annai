import { useMemo } from 'react'

import type { FileDraft } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'
import { DraftDisplay } from './DraftDisplay.tsx'

interface Props {
  path: string
}

export const FileLevelComments = ({ path }: Props) => {
  const { drafts: allDrafts } = useDrafts()

  const fileDrafts = useMemo<FileDraft[]>(
    () => allDrafts.filter((d): d is FileDraft => d.kind === 'file' && d.path === path),
    [allDrafts, path],
  )

  if (fileDrafts.length === 0) return null

  return (
    <div className="file-level-comments">
      {fileDrafts.map(draft => <DraftDisplay key={draft.id} draft={draft} />)}
    </div>
  )
}
