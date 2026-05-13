import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { Note } from '../../src/frontend/components/Note.tsx'

const baseProps = {
  marginTop: 0,
  naturalHeight: null,
  collapsedHeight: 32,
  onNaturalHeightChange: () => {},
}

describe('<Note>', () => {
  it('renders title + kind label + line range', () => {
    render(
      <Note
        {...baseProps}
        annotation={{
          id: 'a1',
          kind: 'discrepancy',
          title: 'Scope doc disagrees',
          body: 'The doc says `foo`; the code says `bar`.',
          lineRange: [10, 20],
        }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )

    expect(screen.getByText('Discrepancy')).toBeInTheDocument()
    expect(screen.getByText('Scope doc disagrees')).toBeInTheDocument()
    expect(screen.getByText('L10–20')).toBeInTheDocument()
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    const { container } = render(
      <Note
        {...baseProps}
        annotation={{ id: 'a1', kind: 'note', title: 'T', body: 'B', lineRange: [1, 1] }}
        collapsed={false}
        onToggle={onToggle}
      />,
    )

    fireEvent.click(container.querySelector('.note')!)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('applies the collapsed class when collapsed', () => {
    const { container, rerender } = render(
      <Note
        {...baseProps}
        annotation={{ id: 'a1', kind: 'note', title: 'T', body: 'B', lineRange: [1, 1] }}
        collapsed={false}
        onToggle={() => {}}
      />,
    )

    expect(container.querySelector('.note')!.classList.contains('collapsed')).toBe(false)

    rerender(
      <Note
        {...baseProps}
        annotation={{ id: 'a1', kind: 'note', title: 'T', body: 'B', lineRange: [1, 1] }}
        collapsed={true}
        onToggle={() => {}}
      />,
    )

    expect(container.querySelector('.note')!.classList.contains('collapsed')).toBe(true)
  })
})
