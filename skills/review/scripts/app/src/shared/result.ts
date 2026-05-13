/**
 * Final payload shape written to result.json when the reviewer submits.
 *
 * Declared for v0.2+. The v0.1 daemon never writes result.json — the
 * `result` CLI subcommand exits with "not yet implemented".
 */

export const REVIEW_DECISIONS = {
  approve: 'approve',
  comment: 'comment',
  'request-changes': 'request-changes',
} as const
export type ReviewDecision = typeof REVIEW_DECISIONS[keyof typeof REVIEW_DECISIONS]

export interface ResultComment {
  path: string
  line: number
  body: string
}

export interface Result {
  decision: ReviewDecision
  body: string
  comments: ResultComment[]
}
