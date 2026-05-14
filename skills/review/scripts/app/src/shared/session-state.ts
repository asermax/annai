/**
 * Wire shape of GET /api/state and the on-disk state.json snapshot.
 *
 * Shared so the frontend can import it without dragging in the node-only
 * Session class.
 */

import type { ClientError } from './client-errors.ts'
import type { Draft } from './drafts.ts'
import type { ReviewDecision } from './result.ts'

export type SessionDecision = ReviewDecision | 'pending'

export interface SessionStateSnapshot {
  sessionId: string
  port: number | null
  startedAt: string
  decision: SessionDecision
  prBody: string
  drafts: Draft[]
  clientErrors: ClientError[]
}
