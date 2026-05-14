import { useMemo } from 'react'

import type { Draft } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'
import { onSubmitKey } from '../lib/keyboard.ts'

const refLabel = (draft: Draft): string => {
  if (draft.kind === 'file') return 'file'
  if (draft.kind === 'line') return `L${draft.line}`
  return `L${draft.startLine}–${draft.line}`
}

const firstLine = (s: string, max = 100): string => {
  const line = s.split('\n')[0] ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

const groupByPath = (drafts: Draft[]): Array<[string, Draft[]]> => {
  const map = new Map<string, Draft[]>()
  for (const d of drafts) {
    const arr = map.get(d.path) ?? []
    arr.push(d)
    map.set(d.path, arr)
  }
  return [...map.entries()]
}

export const ConfirmReviewModal = () => {
  const {
    confirmReview,
    drafts,
    prBody,
    setPrBody,
    submitting,
    submitError,
    submit,
    closeConfirmReview,
  } = useDrafts()

  const grouped = useMemo(() => groupByPath(drafts), [drafts])

  if (confirmReview == null) return null

  const trimmedPrBody = prBody.trim()
  const hasContent = drafts.length > 0 || trimmedPrBody.length > 0
  const blockCommentEmpty = confirmReview === 'comment' && !hasContent
  const isCleanApprove = confirmReview === 'approve' && !hasContent

  const title = confirmReview === 'approve' ? 'Approve this PR?' : 'Submit comment review?'

  const onConfirm = (): void => {
    if (blockCommentEmpty || submitting) return
    void submit(confirmReview)
  }

  return (
    <div className="modal-backdrop" onClick={closeConfirmReview}>
      <div className="modal confirm-review" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>{title}</h3>

        <section className="overall-comment">
          <h4>Overall comment</h4>
          <p className="hint">Optional. Shows at the top of your review on GitHub.</p>
          <textarea
            value={prBody}
            onChange={e => setPrBody(e.target.value)}
            onKeyDown={onSubmitKey(onConfirm)}
            placeholder="Summarise your review here…"
            rows={4}
            disabled={submitting}
          />
        </section>

        {drafts.length > 0 ? (
          <section className="preview-drafts">
            <h4>Inline comments ({drafts.length})</h4>
            {grouped.map(([path, items]) => (
              <div key={path} className="file-group">
                <div className="path">{path}</div>
                <ul>
                  {items.map(d => (
                    <li key={d.id}>
                      <span className="ref">{refLabel(d)}</span>
                      <span className="body-preview">{firstLine(d.body)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ) : null}

        {blockCommentEmpty ? (
          <div className="warning">Nothing to submit — add a comment or use Dismiss.</div>
        ) : isCleanApprove ? (
          <div className="info">No comments — this will be a clean approval.</div>
        ) : null}

        {submitError != null ? <div className="submit-error">{submitError}</div> : null}

        <div className="actions">
          <button type="button" onClick={closeConfirmReview} disabled={submitting}>Cancel</button>
          <button
            type="button"
            className="primary"
            onClick={onConfirm}
            disabled={submitting || blockCommentEmpty}
          >
            {submitting ? 'Submitting…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}
