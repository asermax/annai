/**
 * Final payload written to result.json when the reviewer submits.
 *
 * `decision` is narrowed to approve | comment (no request-changes) — see
 * docs/annai-architecture.md §"Decision UX". Dismiss is not a decision; it
 * routes through session-aborted, not result.json.
 */

import { z } from 'zod'
import { draftSchema, type Draft } from './drafts.ts'

export const REVIEW_DECISIONS = {
  approve: 'approve',
  comment: 'comment',
} as const
export type ReviewDecision = typeof REVIEW_DECISIONS[keyof typeof REVIEW_DECISIONS]

export type ResultComment = Draft

export const resultSchema = z.object({
  decision: z.enum([REVIEW_DECISIONS.approve, REVIEW_DECISIONS.comment]),
  body: z.string(),
  comments: z.array(draftSchema),
  commitId: z.string().optional(),
})

export type Result = z.infer<typeof resultSchema>
