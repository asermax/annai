import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { Session } from '../../src/daemon/session.ts'
import { MAX_CLIENT_ERRORS } from '../../src/shared/client-errors.ts'
import type { Surface } from '../../src/shared/surface.ts'

const dummySurface: Surface = {
  subject: {
    kind: 'pr',
    url: 'https://github.com/x/y/pull/1',
    title: 't', number: 1, branch: 'b', baseBranch: 'main',
    stats: { additions: 0, deletions: 0, files: 0 },
  },
  tldr: '',
  repo: { path: '.' },
  groups: [],
}

const makeSession = () => {
  const dir = mkdtempSync(join(tmpdir(), 'annai-session-'))
  return {
    session: new Session({ sessionId: 's-test', surface: dummySurface, statePath: join(dir, 'state.json') }),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

describe('Session.recordClientError', () => {
  it('appends an entry and surfaces it in the snapshot', () => {
    const { session, cleanup } = makeSession()
    try {
      session.recordClientError({ source: 'window-error', message: 'boom' })
      const snap = session.snapshot()
      expect(snap.clientErrors.length).toBe(1)
      expect(snap.clientErrors[0]!.source).toBe('window-error')
      expect(snap.clientErrors[0]!.message).toBe('boom')
      expect(typeof snap.clientErrors[0]!.at).toBe('string')
    } finally {
      cleanup()
    }
  })

  it('caps at MAX_CLIENT_ERRORS, retaining the most recent', () => {
    const { session, cleanup } = makeSession()
    try {
      for (let i = 0; i < MAX_CLIENT_ERRORS + 10; i++) {
        session.recordClientError({ source: 'window-error', message: `err-${i}` })
      }
      const snap = session.snapshot()
      expect(snap.clientErrors.length).toBe(MAX_CLIENT_ERRORS)
      // Oldest dropped first → first remaining = err-10.
      expect(snap.clientErrors[0]!.message).toBe('err-10')
      expect(snap.clientErrors[MAX_CLIENT_ERRORS - 1]!.message).toBe(`err-${MAX_CLIENT_ERRORS + 9}`)
    } finally {
      cleanup()
    }
  })

  it('buildResult ignores clientErrors (not part of the GitHub submission)', () => {
    const { session, cleanup } = makeSession()
    try {
      session.recordClientError({ source: 'error-boundary', message: 'render fail' })
      session.setDecision('comment')
      const result = session.buildResult()
      // No `clientErrors` field on Result.
      expect(Object.keys(result)).not.toContain('clientErrors')
    } finally {
      cleanup()
    }
  })
})
