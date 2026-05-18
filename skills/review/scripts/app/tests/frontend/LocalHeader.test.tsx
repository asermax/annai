import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

import { LocalHeader } from '../../src/frontend/components/LocalHeader.tsx'

describe('<LocalHeader>', () => {
  it('renders title, "local" badge, branch vs base, stats, and TL;DR', () => {
    render(
      <LocalHeader
        subject={{
          kind: 'local',
          title: 'Wire up scheduler retry',
          branch: 'work/agent-draft',
          baseRef: 'HEAD',
          stats: { additions: 23, deletions: 4, files: 2 },
        }}
        tldr="Agent draft of the retry path."
      />,
    )

    expect(screen.getByText('Wire up scheduler retry')).toBeInTheDocument()
    expect(screen.getByText('local')).toBeInTheDocument()
    expect(screen.getByText('work/agent-draft')).toBeInTheDocument()
    expect(screen.getByText('HEAD')).toBeInTheDocument()
    expect(screen.getByText(/\+23 \/ −4 across 2 files/)).toBeInTheDocument()
    expect(screen.getByText('Agent draft of the retry path.')).toBeInTheDocument()
  })
})
