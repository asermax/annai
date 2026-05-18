import { marked } from 'marked'
import type { PrSubject } from '../../shared/surface.ts'

interface Props {
  pr: PrSubject
  tldr: string
}

export const PRHeader = ({ pr, tldr }: Props) => {
  const tldrHtml = tldr.length > 0 ? marked.parse(tldr, { async: false }) as string : ''

  return (
    <header className="pr-header">
      <h1>
        <a href={pr.url} target="_blank" rel="noreferrer">{pr.title}</a>
        {' '}
        <span className="pr-num">#{pr.number}</span>
      </h1>
      <div className="meta">
        <code>{pr.branch}</code>
        {' → '}
        <code>{pr.baseBranch}</code>
        <span className="sep" />
        <span>+{pr.stats.additions} / −{pr.stats.deletions} across {pr.stats.files} {pr.stats.files === 1 ? 'file' : 'files'}</span>
      </div>
      {tldr.length > 0 ? <div className="tldr" dangerouslySetInnerHTML={{ __html: tldrHtml }} /> : null}
    </header>
  )
}
