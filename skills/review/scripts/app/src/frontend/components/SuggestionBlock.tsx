import { useState } from 'react'
import { marked } from 'marked'

import type { Suggestion } from '../../shared/surface.ts'
import type { DiffSide, DraftInput } from '../../shared/drafts.ts'
import { useDrafts } from '../state/drafts.tsx'

interface Props {
  suggestion: Suggestion
  path: string
  side: DiffSide
}

const buildDraftBody = (suggestion: Suggestion): string => {
  if (suggestion.suggestionCode == null || suggestion.suggestionCode.length === 0) return suggestion.body

  return `${suggestion.body}\n\n\`\`\`suggestion\n${suggestion.suggestionCode}\n\`\`\``
}

const buildDraftInput = (suggestion: Suggestion, path: string, side: DiffSide): DraftInput => {
  const [start, end] = suggestion.lineRange
  const body = buildDraftBody(suggestion)

  if (start === end) {
    return { kind: 'line', path, line: end, side, body }
  }

  return { kind: 'range', path, startLine: start, startSide: side, line: end, side, body }
}

export const SuggestionBlock = ({ suggestion, path, side }: Props) => {
  const { addDraft, resolveSuggestion } = useDrafts()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const bodyHtml = marked.parse(suggestion.body, { async: false }) as string
  const lineLabel = suggestion.lineRange[0] === suggestion.lineRange[1]
    ? `L${suggestion.lineRange[0]}`
    : `L${suggestion.lineRange[0]}–${suggestion.lineRange[1]}`

  const accept = async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await addDraft(buildDraftInput(suggestion, path, side))
      resolveSuggestion(suggestion.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setBusy(false)
    }
  }

  const dismiss = (): void => {
    resolveSuggestion(suggestion.id)
  }

  return (
    <div className="suggestion-block">
      <div className="head">
        <span className="kind">Suggestion</span>
        <span className="ref">{lineLabel}</span>
        <span className="spacer" />
        <button type="button" className="text-action" onClick={accept} disabled={busy}>
          {busy ? 'Accepting…' : 'Accept as draft'}
        </button>
        <button type="button" className="text-action danger" onClick={dismiss} disabled={busy}>Dismiss</button>
      </div>
      <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {suggestion.suggestionCode != null ? (
        <div className="suggestion">
          <span className="label">Proposed code</span>
          {suggestion.suggestionCode}
        </div>
      ) : null}
      {error != null ? <div className="composer-error">{error}</div> : null}
    </div>
  )
}
