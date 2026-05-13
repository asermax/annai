import { useEffect, useState } from 'react'
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
  const [activeId, setActiveId] = useState<string | null>(groups[0]?.id ?? null)

  useEffect(() => {
    const sections = groups
      .map(group => document.getElementById(group.id))
      .filter((el): el is HTMLElement => el != null)

    if (sections.length === 0) return

    // track which sections are currently intersecting the activation strip
    const visible = new Set<string>()
    const ordered = groups.map(group => group.id)

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visible.add(entry.target.id)
          } else {
            visible.delete(entry.target.id)
          }
        }

        // topmost section currently inside the strip wins
        const topmostVisible = ordered.find(id => visible.has(id))
        if (topmostVisible != null) {
          setActiveId(topmostVisible)
          return
        }

        // fallback for tall sections that span past the strip: last section
        // whose top is at or above the strip's upper edge
        const threshold = window.innerHeight * 0.2
        let fallback: string | null = ordered[0] ?? null
        for (const id of ordered) {
          const top = document.getElementById(id)?.getBoundingClientRect().top ?? Infinity
          if (top <= threshold) fallback = id
        }
        setActiveId(fallback)
      },
      {
        rootMargin: '-20% 0px -75% 0px',
        threshold: 0,
      },
    )

    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [groups])

  return (
    <aside className="outline-nav">
      <div className="compact">
        {groups.map(group => (
          <span key={group.id} className={`dash h2${group.id === activeId ? ' active' : ''}`} />
        ))}
      </div>
      <div className="full">
        {groups.map(group => (
          <a key={group.id} className={`item h2${group.id === activeId ? ' active' : ''}`} href={`#${group.id}`}>
            <span>{KIND_ICON[group.kind] ?? '·'}</span>
            <span>{group.title}</span>
          </a>
        ))}
      </div>
    </aside>
  )
}
