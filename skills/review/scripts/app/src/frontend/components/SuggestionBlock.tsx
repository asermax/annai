import { marked } from 'marked'
import type { Suggestion } from '../../shared/surface.ts'

interface Props {
  suggestion: Suggestion
}

export const SuggestionBlock = ({ suggestion }: Props) => {
  const bodyHtml = marked.parse(suggestion.body, { async: false }) as string
  const lineLabel = suggestion.lineRange[0] === suggestion.lineRange[1]
    ? `L${suggestion.lineRange[0]}`
    : `L${suggestion.lineRange[0]}–${suggestion.lineRange[1]}`

  return (
    <div className="suggestion-block">
      <div className="head">
        <span>Suggestion</span>
        <span className="ref">{lineLabel}</span>
      </div>
      <div className="body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      {suggestion.suggestionCode != null ? (
        <div className="suggestion">
          <span className="label">Proposed code</span>
          {suggestion.suggestionCode}
        </div>
      ) : null}
    </div>
  )
}
