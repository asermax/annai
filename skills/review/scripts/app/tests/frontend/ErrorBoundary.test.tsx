import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ErrorBoundary } from '../../src/frontend/components/ErrorBoundary.tsx'

const Bomb = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('boom')
  return <div>safe</div>
}

describe('<ErrorBoundary>', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    // React 19 prints uncaught errors via console.error inside ErrorBoundary
    // tests. Silence the noise so the test output stays readable.
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    consoleError.mockRestore()
  })

  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('safe')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders the fallback and posts to /api/client-errors when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={true} />
      </ErrorBoundary>,
    )

    expect(screen.getByText(/Surface failed to render/)).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()

    const calls = fetchMock.mock.calls.filter(([url]) => url === '/api/client-errors')
    expect(calls.length).toBeGreaterThan(0)
    const body = JSON.parse((calls[0]![1] as RequestInit).body as string)
    expect(body.source).toBe('error-boundary')
    expect(body.message).toBe('boom')
  })
})
