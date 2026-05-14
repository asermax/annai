import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { SubmitBar } from '../../src/frontend/components/SubmitBar.tsx'
import { ConfirmReviewModal } from '../../src/frontend/components/ConfirmReviewModal.tsx'
import { DraftsProvider } from '../../src/frontend/state/drafts.tsx'

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stateWith = (drafts: unknown[], prBody = ''): unknown => ({
  sessionId: 's', port: 1, startedAt: 'now', decision: 'pending', prBody, drafts,
})

const lineDraft = {
  id: 'l1', kind: 'line', path: 'src/foo.ts', line: 42, side: 'RIGHT',
  body: 'first line\nsecond line', createdAt: 'now', updatedAt: 'now',
}
const fileDraft = {
  id: 'f1', kind: 'file', path: 'src/foo.ts', body: 'whole file', createdAt: 'now', updatedAt: 'now',
}

const renderWith = (initialState: unknown): ReturnType<typeof render> => {
  const fetchMock = vi.fn()
  fetchMock.mockImplementation(async (url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? 'GET').toUpperCase()
    if (url === '/api/state' && method === 'GET') return jsonResponse(200, initialState)
    if (url === '/api/submit' && method === 'POST') return jsonResponse(200, { ok: true, commentCount: 0 })
    throw new Error(`unexpected ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)

  return render(
    <DraftsProvider>
      <SubmitBar />
      <ConfirmReviewModal />
    </DraftsProvider>,
  )
}

describe('<ConfirmReviewModal>', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('Approve modal with content shows file-grouped preview and PR body', async () => {
    renderWith(stateWith([lineDraft, fileDraft], 'Overall summary'))

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(screen.getByText('Approve this PR?')).toBeInTheDocument()
    expect(screen.getByText('Overall summary')).toBeInTheDocument()
    // file path grouping renders 'src/foo.ts' as the group header
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument()
    expect(screen.getByText('first line')).toBeInTheDocument()
    expect(screen.getByText('file')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled()
  })

  it('Approve modal with zero drafts and empty PR body shows clean-approval info but allows confirm', async () => {
    renderWith(stateWith([], ''))

    await waitFor(() => expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(screen.getByText(/clean approval/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled()
  })

  it('Comment modal with zero drafts and empty PR body shows blocking warning and disables confirm', async () => {
    renderWith(stateWith([], ''))

    await waitFor(() => expect(screen.getByRole('button', { name: /comment/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /comment/i }))

    expect(screen.getByText(/nothing to submit/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled()
  })

  it('Comment modal with only a PR body (no drafts) allows confirm', async () => {
    renderWith(stateWith([], 'just an overall thought'))

    await waitFor(() => expect(screen.getByRole('button', { name: /comment/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /comment/i }))

    expect(screen.getByText('just an overall thought')).toBeInTheDocument()
    expect(screen.queryByText(/nothing to submit/i)).toBeNull()
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled()
  })
})
