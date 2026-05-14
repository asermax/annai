import { useEffect, useRef, useState } from 'react'

import type { Anchor } from '../state/drafts.tsx'
import { useDrafts } from '../state/drafts.tsx'
import { onSubmitKey } from '../lib/keyboard.ts'

interface Props {
  anchor: Anchor
}

const formatRange = (anchor: Anchor): string => (
  anchor.kind === 'line'
    ? `L${anchor.line}`
    : `L${anchor.startLine}–${anchor.line}`
)

export const DraftComposer = ({ anchor }: Props) => {
  const { addDraft, closeAnchor } = useDrafts()
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Explicit focus on mount — React's autoFocus prop can be lost when the
  // composer is mounted inside @pierre/diffs's annotation slot.
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  useEffect(() => { textareaRef.current?.focus() }, [])

  const save = async (): Promise<void> => {
    const trimmed = body.trim()
    if (trimmed.length === 0 || saving) return

    setSaving(true)
    setError(null)

    try {
      if (anchor.kind === 'line') {
        await addDraft({ kind: 'line', path: anchor.path, line: anchor.line, side: anchor.side, body: trimmed })
      } else {
        await addDraft({
          kind: 'range',
          path: anchor.path,
          startLine: anchor.startLine,
          startSide: anchor.startSide,
          line: anchor.line,
          side: anchor.side,
          body: trimmed,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  return (
    <div className="draft-composer">
      <div className="head">
        <span className="kind">Draft comment</span>
        <span className="ref">{formatRange(anchor)}</span>
      </div>
      <textarea
        ref={textareaRef}
        value={body}
        onChange={e => setBody(e.target.value)}
        onKeyDown={onSubmitKey(() => { void save() })}
        placeholder="Leave a comment…"
        rows={4}
        disabled={saving}
      />
      {error != null ? <div className="composer-error">{error}</div> : null}
      <div className="actions">
        <button type="button" onClick={closeAnchor} disabled={saving}>Cancel</button>
        <button type="button" className="primary" onClick={save} disabled={saving || body.trim().length === 0}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
