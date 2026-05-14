import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { SubmitBar } from '../../src/frontend/components/SubmitBar.tsx'
import { DismissSessionModal } from '../../src/frontend/components/DismissSessionModal.tsx'
import { DraftsProvider } from '../../src/frontend/state/drafts.tsx'

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const stateWith = (drafts: unknown[], prBody = ''): unknown => ({
  sessionId: 's', port: 1, startedAt: 'now', decision: 'pending', prBody, drafts,
})

const draft = {
  id: 'd1', kind: 'line', path: 'src/foo.ts', line: 5, side: 'RIGHT',
  body: 'tbd', createdAt: 'now', updatedAt: 'now',
}

const renderWith = (initialState: unknown) => {
  const dismissCalls: Array<unknown> = []
  const fetchMock = vi.fn()
  fetchMock.mockImplementation(async (url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? 'GET').toUpperCase()
    if (url === '/api/state' && method === 'GET') return jsonResponse(200, initialState)
    if (url === '/api/dismiss' && method === 'POST') {
      dismissCalls.push(opts)
      return jsonResponse(200, { ok: true })
    }
    throw new Error(`unexpected ${method} ${url}`)
  })
  vi.stubGlobal('fetch', fetchMock)

  return {
    ...render(
      <DraftsProvider>
        <SubmitBar />
        <DismissSessionModal />
      </DraftsProvider>,
    ),
    dismissCalls,
  }
}

describe('<DismissSessionModal>', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a single-line confirm when there are no drafts and no PR body', async () => {
    renderWith(stateWith([], ''))

    await waitFor(() => expect(screen.getByRole('button', { name: /dismiss session/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /dismiss session/i }))

    expect(screen.getByText(/the session will close/i)).toBeInTheDocument()
    expect(screen.queryByText(/will be discarded/i)).toBeNull()
    expect(screen.queryByRole('list')).toBeNull()
  })

  it('warns + lists drafts that will be discarded', async () => {
    renderWith(stateWith([draft], ''))

    await waitFor(() => expect(screen.getByRole('button', { name: /dismiss session/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /dismiss session/i }))

    expect(screen.getByText(/1 draft will be discarded/i)).toBeInTheDocument()
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument()
    expect(screen.getByText('L5')).toBeInTheDocument()
  })

  it('clicking Confirm POSTs /api/dismiss', async () => {
    const { dismissCalls } = renderWith(stateWith([draft], ''))

    await waitFor(() => expect(screen.getByRole('button', { name: /dismiss session/i })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: /dismiss session/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    await waitFor(() => expect(dismissCalls).toHaveLength(1))
  })
})
