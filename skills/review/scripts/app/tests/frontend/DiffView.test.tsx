import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'

import { DiffView } from '../../src/frontend/components/DiffView.tsx'
import { DraftsProvider } from '../../src/frontend/state/drafts.tsx'
import type { Diff } from '../../src/shared/surface.ts'

const STATE_RESPONSE = {
  sessionId: 's1',
  port: 1,
  startedAt: '2026-05-13T00:00:00Z',
  decision: 'pending',
  prBody: '',
  drafts: [],
  clientErrors: [],
}

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// A diff with one annotation + one suggestion. Regression target:
// before the v0.3.1 fix, mounting <PatchDiff> with both `onGutterUtilityClick`
// and `renderGutterUtility` threw at setup time as soon as the surface had
// annotations on it ("Cannot use both 'onGutterUtilityClick' and render
// utility callbacks"). Mounting is enough to trip the assertion.
const fixture: Diff = {
  id: 'diff-foo',
  path: 'src/foo.ts',
  hunks: [
    {
      header: '@@ -1,2 +1,4 @@',
      lines: [
        { kind: 'context', oldLine: 1, newLine: 1, content: 'export const foo = () => {' },
        { kind: 'add',     oldLine: null, newLine: 2, content: '  return 42' },
        { kind: 'add',     oldLine: null, newLine: 3, content: '  // new comment' },
        { kind: 'context', oldLine: 2, newLine: 4, content: '}' },
      ],
    },
  ],
  annotations: [
    {
      id: 'ann-1',
      kind: 'note',
      title: 'Why 42',
      body: 'It is the answer.',
      lineRange: [2, 2],
    },
  ],
  suggestions: [
    {
      id: 'sug-1',
      body: 'Consider returning a const so consumers cannot reassign.',
      lineRange: [2, 2],
      suggestionCode: '  return 42 as const',
    },
  ],
}

describe('<DiffView>', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/state') return jsonResponse(200, STATE_RESPONSE)
      throw new Error(`unexpected fetch: ${url}`)
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('mounts with annotations and suggestions without throwing', () => {
    expect(() => {
      render(
        <DraftsProvider>
          <DiffView diff={fixture} />
        </DraftsProvider>,
      )
    }).not.toThrow()
  })

  it('renders the diff path in its header', () => {
    const { container } = render(
      <DraftsProvider>
        <DiffView diff={fixture} />
      </DraftsProvider>,
    )

    expect(container.querySelector('.diff-head .path')!.textContent).toBe('src/foo.ts')
  })
})
