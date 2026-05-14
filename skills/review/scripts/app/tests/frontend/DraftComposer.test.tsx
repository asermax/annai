import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

import { DraftComposer } from '../../src/frontend/components/DraftComposer.tsx'
import { DraftsProvider } from '../../src/frontend/state/drafts.tsx'

const STATE_RESPONSE = {
  sessionId: 's1',
  port: 1,
  startedAt: '2026-05-13T00:00:00Z',
  decision: 'pending',
  prBody: '',
  drafts: [],
}

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('<DraftComposer>', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('POSTs a line draft on Save', async () => {
    fetchMock.mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase()
      if (url === '/api/state' && method === 'GET') return jsonResponse(200, STATE_RESPONSE)

      if (url === '/api/drafts' && method === 'POST') {
        const draft = {
          id: 'new-id',
          createdAt: '2026-05-13T00:00:00Z',
          updatedAt: '2026-05-13T00:00:00Z',
          ...JSON.parse(opts!.body as string),
        }
        return jsonResponse(201, draft)
      }

      throw new Error(`unexpected fetch ${method} ${url}`)
    })

    render(
      <DraftsProvider>
        <DraftComposer anchor={{ kind: 'line', path: 'src/foo.ts', line: 12, side: 'RIGHT' }} />
      </DraftsProvider>,
    )

    fireEvent.change(screen.getByPlaceholderText(/leave a comment/i), { target: { value: 'hello there' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const createCalls = fetchMock.mock.calls.filter(([u, o]) => u === '/api/drafts' && (o as RequestInit)?.method === 'POST')
      expect(createCalls).toHaveLength(1)
      expect(JSON.parse((createCalls[0][1] as RequestInit).body as string)).toEqual({
        kind: 'line',
        path: 'src/foo.ts',
        line: 12,
        side: 'RIGHT',
        body: 'hello there',
      })
    })
  })

  it('POSTs a range draft with start + end when anchor is a range', async () => {
    fetchMock.mockImplementation(async (url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? 'GET').toUpperCase()
      if (url === '/api/state' && method === 'GET') return jsonResponse(200, STATE_RESPONSE)
      if (url === '/api/drafts' && method === 'POST') {
        return jsonResponse(201, { id: 'r', createdAt: 'now', updatedAt: 'now', ...JSON.parse(opts!.body as string) })
      }
      throw new Error(`unexpected ${method} ${url}`)
    })

    render(
      <DraftsProvider>
        <DraftComposer anchor={{
          kind: 'range',
          path: 'src/bar.ts',
          startLine: 4,
          startSide: 'RIGHT',
          line: 9,
          side: 'RIGHT',
        }} />
      </DraftsProvider>,
    )

    fireEvent.change(screen.getByPlaceholderText(/leave a comment/i), { target: { value: 'span comment' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))

    await waitFor(() => {
      const create = fetchMock.mock.calls.find(([u, o]) => u === '/api/drafts' && (o as RequestInit)?.method === 'POST')
      expect(create).toBeDefined()
      expect(JSON.parse((create![1] as RequestInit).body as string)).toEqual({
        kind: 'range',
        path: 'src/bar.ts',
        startLine: 4,
        startSide: 'RIGHT',
        line: 9,
        side: 'RIGHT',
        body: 'span comment',
      })
    })
  })

  it('disables Save when the body is empty', () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/state') return jsonResponse(200, STATE_RESPONSE)
      throw new Error('unexpected')
    })

    render(
      <DraftsProvider>
        <DraftComposer anchor={{ kind: 'line', path: 'a', line: 1, side: 'RIGHT' }} />
      </DraftsProvider>,
    )

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('renders the range label "L4–9" for a range anchor', () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url === '/api/state') return jsonResponse(200, STATE_RESPONSE)
      throw new Error('unexpected')
    })

    render(
      <DraftsProvider>
        <DraftComposer anchor={{
          kind: 'range', path: 'a', startLine: 4, startSide: 'RIGHT', line: 9, side: 'RIGHT',
        }} />
      </DraftsProvider>,
    )

    expect(screen.getByText('L4–9')).toBeInTheDocument()
  })
})
