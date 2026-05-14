import { useMemo } from 'react'

import type { Draft } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'

const refLabel = (draft: Draft): string => {
  if (draft.kind === 'file') return 'file'
  if (draft.kind === 'line') return `L${draft.line}`
  return `L${draft.startLine}–${draft.line}`
}

export const DismissSessionModal = () => {
  const {
    confirmDismiss,
    drafts,
    prBody,
    submitting,
    submitError,
    dismissSession,
    closeConfirmDismiss,
  } = useDrafts()

  const items = useMemo(() => drafts.map(d => ({ id: d.id, path: d.path, ref: refLabel(d) })), [drafts])

  if (!confirmDismiss) return null

  const hasDrafts = drafts.length > 0
  const hasPrBody = prBody.trim().length > 0
  const hasContent = hasDrafts || hasPrBody

  return (
    <div className="modal-backdrop" onClick={closeConfirmDismiss}>
      <div className="modal dismiss-session" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Dismiss session?</h3>

        {hasContent ? (
          <>
            <div className="warning">
              {hasDrafts
                ? `${drafts.length} draft${drafts.length === 1 ? '' : 's'} will be discarded.`
                : 'The PR-level comment will be discarded.'}
            </div>
            {hasDrafts ? (
              <ul className="dismiss-list">
                {items.map(it => (
                  <li key={it.id}><span className="path">{it.path}</span><span className="ref">{it.ref}</span></li>
                ))}
              </ul>
            ) : null}
            <p className="hint">No review will be sent to GitHub.</p>
          </>
        ) : (
          <p>The session will close. No review will be sent.</p>
        )}

        {submitError != null ? <div className="submit-error">{submitError}</div> : null}

        <div className="actions">
          <button type="button" onClick={closeConfirmDismiss} disabled={submitting}>Cancel</button>
          <button
            type="button"
            className="primary danger"
            onClick={() => void dismissSession()}
            disabled={submitting}
          >
            {submitting ? 'Dismissing…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
