import type { Group } from '../../shared/surface.ts'

interface Props {
  groups: Group[]
}

const KIND_ICON: Record<string, string> = {
  'base-context': '📐',
  'entry-point': '🔌',
  supporting: '🧩',
}

export const OutlineNav = ({ groups }: Props) => {
  return (
    <aside className="outline-nav">
      <div className="compact">
        {groups.map(group => (
          <span key={group.id} className="dash h2" />
        ))}
      </div>
      <div className="full">
        {groups.map(group => (
          <a key={group.id} className="item h2" href={`#${group.id}`}>
            <span>{KIND_ICON[group.kind] ?? '·'}</span>
            <span>{group.title}</span>
          </a>
        ))}
      </div>
    </aside>
  )
}
