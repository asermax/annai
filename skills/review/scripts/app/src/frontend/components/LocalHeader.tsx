import { marked } from 'marked'
import type { LocalSubject } from '../../shared/surface.ts'

interface Props {
  subject: LocalSubject
  tldr: string
}

export const LocalHeader = ({ subject, tldr }: Props) => {
  const tldrHtml = tldr.length > 0 ? marked.parse(tldr, { async: false }) as string : ''

  return (
    <header className="pr-header local">
      <h1>
        {subject.title}
        {' '}
        <span className="pr-num">local</span>
      </h1>
      <div className="meta">
        <code>{subject.branch}</code>
        {' vs '}
        <code>{subject.baseRef}</code>
        <span className="sep" />
        <span>+{subject.stats.additions} / −{subject.stats.deletions} across {subject.stats.files} {subject.stats.files === 1 ? 'file' : 'files'}</span>
      </div>
      {tldr.length > 0 ? <div className="tldr" dangerouslySetInnerHTML={{ __html: tldrHtml }} /> : null}
    </header>
  )
}
