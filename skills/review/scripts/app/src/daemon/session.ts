import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

import type { Surface } from '../shared/surface.ts'
import { surfaceSchema } from '../shared/surface.ts'
import type { AnnaiEvent } from '../shared/events.ts'
import type { Draft, DraftInput, DraftPatch } from '../shared/drafts.ts'
import type { ReviewDecision, Result } from '../shared/result.ts'
import type { SessionStateSnapshot } from '../shared/session-state.ts'

export type { SessionStateSnapshot }

export interface SessionInit {
  sessionId: string
  surface: Surface
  statePath: string
}

export class Session {
  readonly sessionId: string
  readonly surface: Surface
  private readonly statePath: string
  private state: SessionStateSnapshot

  constructor (init: SessionInit) {
    this.sessionId = init.sessionId
    this.surface = init.surface
    this.statePath = init.statePath
    this.state = {
      sessionId: init.sessionId,
      port: null,
      startedAt: new Date().toISOString(),
      decision: 'pending',
      prBody: '',
      drafts: [],
    }
  }

  private persist (): void {
    writeStateAtomic(this.statePath, this.state)
  }

  setPort (port: number): void {
    this.state = { ...this.state, port }
    this.persist()
  }

  snapshot (): SessionStateSnapshot {
    return { ...this.state, drafts: [...this.state.drafts] }
  }

  // Draft mutators — each returns the resulting Draft (or null for not-found) so
  // the HTTP layer can echo it back to the client.

  addDraft (input: DraftInput): Draft {
    const now = new Date().toISOString()
    const id = randomUUID()
    const base = { id, body: input.body, createdAt: now, updatedAt: now }

    const draft: Draft =
      input.kind === 'line'
        ? { ...base, kind: 'line', path: input.path, line: input.line, side: input.side }
      : input.kind === 'range'
        ? { ...base, kind: 'range', path: input.path, startLine: input.startLine, startSide: input.startSide, line: input.line, side: input.side }
        : { ...base, kind: 'file', path: input.path }

    this.state = { ...this.state, drafts: [...this.state.drafts, draft] }
    this.persist()

    return draft
  }

  editDraft (id: string, patch: DraftPatch): Draft | null {
    const existing = this.state.drafts.find(d => d.id === id)
    if (existing == null) return null

    const updated: Draft = { ...existing, body: patch.body, updatedAt: new Date().toISOString() }
    this.state = { ...this.state, drafts: this.state.drafts.map(d => (d.id === id ? updated : d)) }
    this.persist()

    return updated
  }

  dismissDraft (id: string): boolean {
    const before = this.state.drafts.length
    const next = this.state.drafts.filter(d => d.id !== id)
    if (next.length === before) return false

    this.state = { ...this.state, drafts: next }
    this.persist()

    return true
  }

  setPrBody (prBody: string): void {
    this.state = { ...this.state, prBody }
    this.persist()
  }

  setDecision (decision: ReviewDecision): void {
    this.state = { ...this.state, decision }
    this.persist()
  }

  // Materialise the final review payload. Called from the submit HTTP route
  // (which has just set decision) and from IPC `result`.
  buildResult (commitId?: string): Result {
    if (this.state.decision === 'pending') {
      throw new Error('cannot build result: decision is still pending (submit must set it first)')
    }

    return {
      decision: this.state.decision,
      body: this.state.prBody,
      comments: [...this.state.drafts],
      ...(commitId != null ? { commitId } : {}),
    }
  }
}

// atomic write: write to tmp, rename onto target
export const writeStateAtomic = (statePath: string, snapshot: SessionStateSnapshot): void => {
  mkdirSync(dirname(statePath), { recursive: true })
  const tmp = `${statePath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  renameSync(tmp, statePath)
}

export const writeResultAtomic = (resultPath: string, result: Result): void => {
  mkdirSync(dirname(resultPath), { recursive: true })
  const tmp = `${resultPath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(result, null, 2) + '\n', 'utf8')
  renameSync(tmp, resultPath)
}

export const appendEventLog = (eventsPath: string, event: AnnaiEvent): void => {
  mkdirSync(dirname(eventsPath), { recursive: true })
  appendFileSync(eventsPath, JSON.stringify(event) + '\n', 'utf8')
}

export const loadSurface = (surfacePath: string): Surface => {
  const raw = readFileSync(surfacePath, 'utf8')
  const parsed: unknown = JSON.parse(raw)

  return surfaceSchema.parse(parsed)
}
