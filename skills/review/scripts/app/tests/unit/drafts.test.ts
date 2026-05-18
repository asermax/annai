import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { Session } from '../../src/daemon/session.ts'
import type { Surface } from '../../src/shared/surface.ts'

const minimalSurface: Surface = {
  subject: {
    kind: 'pr',
    url: 'https://github.com/x/y/pull/1',
    title: 't',
    number: 1,
    branch: 'b',
    baseBranch: 'main',
    stats: { additions: 0, deletions: 0, files: 0 },
  },
  tldr: '',
  repo: { path: '.' },
  groups: [],
}

describe('Session draft state', () => {
  let dir: string
  let statePath: string
  let session: Session

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'annai-test-'))
    statePath = join(dir, 'state.json')
    session = new Session({ sessionId: 's1', surface: minimalSurface, statePath })
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('initial snapshot has no drafts, pending decision, empty pr body', () => {
    const snap = session.snapshot()
    expect(snap.drafts).toEqual([])
    expect(snap.decision).toBe('pending')
    expect(snap.prBody).toBe('')
  })

  it('addDraft persists each of the three kinds', () => {
    session.addDraft({ kind: 'line', path: 'a', line: 1, side: 'RIGHT', body: 'x' })
    session.addDraft({ kind: 'range', path: 'a', startLine: 2, startSide: 'RIGHT', line: 5, side: 'RIGHT', body: 'y' })
    session.addDraft({ kind: 'file', path: 'a', body: 'z' })

    const snap = session.snapshot()
    expect(snap.drafts.map(d => d.kind)).toEqual(['line', 'range', 'file'])

    const persisted = JSON.parse(readFileSync(statePath, 'utf8')) as { drafts: unknown[] }
    expect(persisted.drafts).toHaveLength(3)
  })

  it('editDraft updates body and updatedAt; returns the new draft', async () => {
    const draft = session.addDraft({ kind: 'line', path: 'a', line: 1, side: 'RIGHT', body: 'x' })
    await new Promise(r => setTimeout(r, 5))

    const updated = session.editDraft(draft.id, { body: 'new body' })
    expect(updated).not.toBeNull()
    expect(updated!.body).toBe('new body')
    expect(updated!.updatedAt).not.toBe(draft.updatedAt)
    expect(updated!.createdAt).toBe(draft.createdAt)
  })

  it('editDraft returns null for unknown id', () => {
    expect(session.editDraft('does-not-exist', { body: 'x' })).toBeNull()
  })

  it('dismissDraft removes the draft and returns true', () => {
    const d = session.addDraft({ kind: 'file', path: 'a', body: 'b' })
    expect(session.dismissDraft(d.id)).toBe(true)
    expect(session.snapshot().drafts).toHaveLength(0)
  })

  it('dismissDraft returns false for unknown id', () => {
    expect(session.dismissDraft('nope')).toBe(false)
  })

  it('setPrBody persists', () => {
    session.setPrBody('hello world')
    expect(session.snapshot().prBody).toBe('hello world')
  })

  it('buildResult throws when decision is still pending', () => {
    expect(() => session.buildResult()).toThrow(/decision is still pending/)
  })

  it('buildResult after setDecision returns a payload with comments + prBody + commitId', () => {
    session.addDraft({ kind: 'line', path: 'a', line: 1, side: 'RIGHT', body: 'x' })
    session.setPrBody('summary')
    session.setDecision('approve')

    const result = session.buildResult('abc123')
    expect(result.decision).toBe('approve')
    expect(result.body).toBe('summary')
    expect(result.comments).toHaveLength(1)
    expect(result.commitId).toBe('abc123')
  })

  it('buildResult omits commitId when not provided', () => {
    session.setDecision('comment')
    const result = session.buildResult()
    expect(result.commitId).toBeUndefined()
  })
})
