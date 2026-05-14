import type { Surface } from '../../shared/surface.ts'
import { PRHeader } from './PRHeader.tsx'
import { OutlineNav } from './OutlineNav.tsx'
import { Group } from './Group.tsx'
import { MermaidDiagram } from './MermaidDiagram.tsx'
import { ThemeToggle } from './ThemeToggle.tsx'
import { SubmitBar } from './SubmitBar.tsx'
import { PRLevelComment } from './PRLevelComment.tsx'
import { ConfirmReviewModal } from './ConfirmReviewModal.tsx'
import { DismissSessionModal } from './DismissSessionModal.tsx'

interface Props {
  surface: Surface
}

export const SurfacePage = ({ surface }: Props) => {
  return (
    <>
      <nav className="top">
        <span className="brand">Annai</span>
        <span className="pill">v0.2 · draft + submit</span>
        <span className="pill mono">{surface.pr.title.slice(0, 60)}{surface.pr.title.length > 60 ? '…' : ''} #{surface.pr.number}</span>
        <span className="spacer" />
        <SubmitBar />
        <ThemeToggle />
      </nav>

      <OutlineNav groups={surface.groups} />

      <div className="page">
        <div className="container">
          <PRHeader pr={surface.pr} tldr={surface.tldr} />

          {surface.diagrams != null && surface.diagrams.length > 0 ? (
            <section className="group">
              <header className="group-head">
                <div className="label">PR-level diagrams</div>
              </header>
              {surface.diagrams.map(diagram => <MermaidDiagram key={diagram.id} diagram={diagram} />)}
            </section>
          ) : null}

          {surface.groups.map(group => <Group key={group.id} group={group} />)}

          {surface.reviewPrompts != null && surface.reviewPrompts.length > 0 ? (
            <section className="group">
              <header className="group-head">
                <div className="label">Review prompts</div>
                <h2>Things to keep in mind as you read</h2>
              </header>
              <ul>
                {surface.reviewPrompts.map((prompt, idx) => <li key={idx}>{prompt}</li>)}
              </ul>
            </section>
          ) : null}

          <PRLevelComment />
        </div>
      </div>

      <ConfirmReviewModal />
      <DismissSessionModal />
    </>
  )
}
