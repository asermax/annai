import { useMemo, useState } from 'react'

import type { FileDraft } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'
import { DraftDisplay } from './DraftDisplay.tsx'

interface Props {
  path: string
}

export const FileLevelComments = ({ path }: Props) => {
  const { drafts: allDrafts, addDraft } = useDrafts()

  const fileDrafts = useMemo<FileDraft[]>(
    () => allDrafts.filter((d): d is FileDraft => d.kind === 'file' && d.path === path),
    [allDrafts, path],
  )

  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (): Promise<void> => {
    const trimmed = body.trim()
    if (trimmed.length === 0 || busy) return

    setBusy(true)
    setError(null)
    try {
      await addDraft({ kind: 'file', path, body: trimmed })
      setBody('')
      setComposing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = (): void => {
    setBody('')
    setComposing(false)
    setError(null)
  }

  return (
    <div className="file-level-comments">
      {fileDrafts.map(draft => <DraftDisplay key={draft.id} draft={draft} />)}
      {composing ? (
        <div className="draft-composer file-level">
          <div className="head">
            <span className="kind">File comment</span>
            <span className="ref">{path}</span>
          </div>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Comment on this file…"
            autoFocus
            rows={3}
            disabled={busy}
          />
          {error != null ? <div className="composer-error">{error}</div> : null}
          <div className="actions">
            <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
            <button type="button" className="primary" onClick={save} disabled={busy || body.trim().length === 0}>
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="file-comment-add" onClick={() => setComposing(true)}>
          + Comment on file
        </button>
      )}
    </div>
  )
}
