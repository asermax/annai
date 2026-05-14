import { useMemo, useState } from 'react'
import { marked } from 'marked'

import type { Draft } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'

interface Props {
  draft: Draft
}

const refLabel = (draft: Draft): string => {
  if (draft.kind === 'file') return 'file'
  if (draft.kind === 'line') return `L${draft.line}`
  return `L${draft.startLine}–${draft.line}`
}

export const DraftDisplay = ({ draft }: Props) => {
  const { editDraft, dismissDraft } = useDrafts()

  const [editing, setEditing] = useState(false)
  const [body, setBody] = useState(draft.body)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bodyHtml = useMemo(() => marked.parse(draft.body, { async: false }) as string, [draft.body])

  const save = async (): Promise<void> => {
    const trimmed = body.trim()
    if (trimmed.length === 0 || busy) return

    setBusy(true)
    setError(null)
    try {
      await editDraft(draft.id, trimmed)
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = (): void => {
    setBody(draft.body)
    setEditing(false)
    setError(null)
  }

  const dismiss = async (): Promise<void> => {
    if (busy) return

    setBusy(true)
    setError(null)
    try {
      await dismissDraft(draft.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  if (editing) {
    return (
      <div className="draft-display editing">
        <div className="head">
          <span className="kind">Draft</span>
          <span className="ref">{refLabel(draft)}</span>
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} disabled={busy} autoFocus />
        {error != null ? <div className="composer-error">{error}</div> : null}
        <div className="actions">
          <button type="button" onClick={cancel} disabled={busy}>Cancel</button>
          <button type="button" className="primary" onClick={save} disabled={busy || body.trim().length === 0}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="draft-display">
      <div className="head">
        <span className="kind">Draft</span>
        <span className="ref">{refLabel(draft)}</span>
        <span className="spacer" />
        <button type="button" className="text-action" onClick={() => setEditing(true)} disabled={busy}>Edit</button>
        <button type="button" className="text-action danger" onClick={dismiss} disabled={busy}>Dismiss</button>
      </div>
      <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {error != null ? <div className="composer-error">{error}</div> : null}
    </div>
  )
}
