import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { Note } from '../../src/frontend/components/Note.tsx'

describe('<Note>', () => {
  it('renders title + kind label + line range', () => {
    render(
      <Note
        annotation={{
          id: 'a1',
          kind: 'discrepancy',
          title: 'Scope doc disagrees',
          body: 'The doc says `foo`; the code says `bar`.',
          lineRange: [10, 20],
        }}
        top={0}
      />,
    )

    expect(screen.getByText('Discrepancy')).toBeInTheDocument()
    expect(screen.getByText('Scope doc disagrees')).toBeInTheDocument()
    expect(screen.getByText('L10–20')).toBeInTheDocument()
  })

  it('toggles expanded class on click', () => {
    const { container } = render(
      <Note
        annotation={{ id: 'a1', kind: 'note', title: 'T', body: 'B', lineRange: [1, 1] }}
        top={0}
      />,
    )

    const note = container.querySelector('.note')!
    expect(note.classList.contains('collapsed')).toBe(true)
    fireEvent.click(note)
    expect(note.classList.contains('expanded')).toBe(true)
  })
})
