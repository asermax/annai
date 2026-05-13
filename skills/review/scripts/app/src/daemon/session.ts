import { readFileSync, writeFileSync, renameSync, appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Surface } from '../shared/surface.ts'
import { surfaceSchema } from '../shared/surface.ts'
import type { AnnaiEvent } from '../shared/events.ts'

export interface SessionStateSnapshot {
  sessionId: string
  port: number | null
  startedAt: string
  decision: 'pending' | 'approve' | 'comment' | 'request-changes'
  drafts: unknown[]   // v0.2
  threads: unknown[]  // v0.2
}

export class Session {
  readonly sessionId: string
  readonly surface: Surface
  private state: SessionStateSnapshot

  constructor (init: { sessionId: string, surface: Surface }) {
    this.sessionId = init.sessionId
    this.surface = init.surface
    this.state = {
      sessionId: init.sessionId,
      port: null,
      startedAt: new Date().toISOString(),
      decision: 'pending',
      drafts: [],
      threads: [],
    }
  }

  setPort (port: number): void {
    this.state = { ...this.state, port }
  }

  snapshot (): SessionStateSnapshot {
    return { ...this.state }
  }
}

// atomic write: write to tmp, rename onto target
export const writeStateAtomic = (statePath: string, snapshot: SessionStateSnapshot): void => {
  mkdirSync(dirname(statePath), { recursive: true })
  const tmp = `${statePath}.tmp-${process.pid}`
  writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8')
  renameSync(tmp, statePath)
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
