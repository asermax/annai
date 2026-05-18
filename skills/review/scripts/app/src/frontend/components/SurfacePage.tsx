import { marked } from 'marked'

import type { Surface } from '../../shared/surface.ts'
import { PRHeader } from './PRHeader.tsx'
import { LocalHeader } from './LocalHeader.tsx'
import { OutlineNav } from './OutlineNav.tsx'
import { Group } from './Group.tsx'
import { MermaidDiagram } from './MermaidDiagram.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { SubmitBar } from './SubmitBar.tsx'
import { ConfirmReviewModal } from './ConfirmReviewModal.tsx'
import { DismissSessionModal } from './DismissSessionModal.tsx'

interface Props {
  surface: Surface
}

const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max)}…` : s)

export const SurfacePage = ({ surface }: Props) => {
  const subject = surface.subject

  const pillLabel = subject.kind === 'pr'
    ? `${truncate(subject.title, 60)} #${subject.number}`
    : `${truncate(subject.title, 60)} · local`

  return (
    <>
      <nav className="top">
        <span className="brand">Annai</span>
        <span className="pill">v{__ANNAI_VERSION__}</span>
        <span className="pill mono">{pillLabel}</span>
        <span className="spacer" />
        <SubmitBar subjectKind={subject.kind} />
        <ThemeToggle />
      </nav>

      <OutlineNav groups={surface.groups} />

      <div className="page">
        <div className="container">
          {subject.kind === 'pr'
            ? <PRHeader pr={subject} tldr={surface.tldr} />
            : <LocalHeader subject={subject} tldr={surface.tldr} />}

          {surface.reviewPrompts != null && surface.reviewPrompts.length > 0 ? (
            <aside className="review-prompts-alert">
              <div className="label">Review prompts · keep in mind as you read</div>
              <ul>
                {surface.reviewPrompts.map((prompt, idx) => (
                  <li
                    key={idx}
                    dangerouslySetInnerHTML={{ __html: marked.parseInline(prompt, { async: false }) as string }}
                  />
                ))}
              </ul>
            </aside>
          ) : null}

          {surface.diagrams != null && surface.diagrams.length > 0 ? (
            <section className="group">
              <header className="group-head">
                <div className="label">PR-level diagrams</div>
              </header>
              {surface.diagrams.map(diagram => <MermaidDiagram key={diagram.id} diagram={diagram} />)}
            </section>
          ) : null}

          {surface.groups.map(group => <Group key={group.id} group={group} />)}
        </div>
      </div>

      <ConfirmReviewModal subjectKind={subject.kind} />
      <DismissSessionModal />
    </>
  )
}
