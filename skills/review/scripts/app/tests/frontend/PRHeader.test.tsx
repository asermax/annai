import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { PRHeader } from '../../src/frontend/components/PRHeader.tsx'

describe('<PRHeader>', () => {
  it('renders title, number, branch arrow, and TL;DR', () => {
    render(
      <PRHeader
        pr={{
          url: 'https://github.com/example-org/example-repo/pull/42',
          title: 'Add scheduling mode',
          number: 42,
          branch: 'feat/scheduling-mode',
          baseBranch: 'main',
          stats: { additions: 87, deletions: 12, files: 4 },
        }}
        tldr="A friendly summary of the PR."
      />,
    )

    expect(screen.getByText('Add scheduling mode')).toBeInTheDocument()
    expect(screen.getByText('#42')).toBeInTheDocument()
    expect(screen.getByText('feat/scheduling-mode')).toBeInTheDocument()
    expect(screen.getByText('main')).toBeInTheDocument()
    expect(screen.getByText(/\+87 \/ −12 across 4 files/)).toBeInTheDocument()
    expect(screen.getByText('A friendly summary of the PR.')).toBeInTheDocument()
  })
})
