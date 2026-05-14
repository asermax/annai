import { useState } from 'react'

import { useDrafts } from '../state/drafts.tsx'
import { onSubmitKey } from '../lib/keyboard.ts'

interface Props {
  path: string
}

export const FileCommentComposer = ({ path }: Props) => {
  const { addDraft, closeFileComposer } = useDrafts()

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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const cancel = (): void => {
    setBody('')
    setError(null)
    closeFileComposer()
  }

  return (
    <div className="draft-composer file-level in-header">
      <div className="head">
        <span className="kind">File comment</span>
        <span className="ref">{path}</span>
      </div>
      <textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={onSubmitKey(() => { void save() })}
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
  )
}
