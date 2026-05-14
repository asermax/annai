import { marked } from 'marked'
import type { Group as GroupType } from '../../shared/surface.ts'
import { ReviewRow } from './ReviewRow.tsx'
import { MermaidDiagram } from './MermaidDiagram.tsx'
import { FileLevelComments } from './FileLevelComments.tsx'

interface Props {
  group: GroupType
}

const KIND_LABEL: Record<string, string> = {
  'base-context': 'Base context',
  'entry-point': 'Entry point',
  supporting: 'Supporting',
}

export const Group = ({ group }: Props) => {
  const introHtml = marked.parse(group.intro, { async: false }) as string

  return (
    <section className="group" id={group.id}>
      <header className="group-head">
        <div className="label">{KIND_LABEL[group.kind] ?? group.kind}</div>
        <h2>{group.title}</h2>
        <div className="group-note" dangerouslySetInnerHTML={{ __html: introHtml }} />
      </header>

      {group.diagrams != null && group.diagrams.map(diagram => (
        <MermaidDiagram key={diagram.id} diagram={diagram} />
      ))}

      {group.diffs.map(diff => (
        <div key={diff.id} className="diff-block">
          <FileLevelComments path={diff.path} />
          <ReviewRow diff={diff} />
        </div>
      ))}
    </section>
  )
}
