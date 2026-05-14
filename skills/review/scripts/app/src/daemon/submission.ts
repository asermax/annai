/**
 * Pure GraphQL request builders for submitting a finished review to GitHub.
 *
 * The flow is three mutations against the GitHub GraphQL API, all routed
 * through `gh api graphql` from cli/submit.ts:
 *
 *   1. addPullRequestReview            — creates a pending review with all
 *                                        line/range threads attached.
 *   2. addPullRequestReviewThread (xN) — one call per file-level draft
 *                                        (subjectType: FILE). The bulk
 *                                        `threads` input on (1) doesn't
 *                                        support file-level threads.
 *   3. submitPullRequestReview         — finalises the pending review with
 *                                        APPROVE or COMMENT.
 *
 * The reviewer sees a single review event with every thread attached — no
 * comment is ever submitted as its own standalone GitHub review.
 */

import type { FileDraft, LineDraft, RangeDraft } from '../shared/drafts.ts'
import type { Result, ReviewDecision } from '../shared/result.ts'

export interface GraphQLCall {
  query: string
  variables: Record<string, unknown>
}

const PR_REVIEW_EVENT: Record<ReviewDecision, 'APPROVE' | 'COMMENT'> = {
  approve: 'APPROVE',
  comment: 'COMMENT',
}

export const ADD_REVIEW_MUTATION = `mutation AddReview($input: AddPullRequestReviewInput!) {
  addPullRequestReview(input: $input) {
    pullRequestReview { id url }
  }
}`

export const ADD_THREAD_MUTATION = `mutation AddThread($input: AddPullRequestReviewThreadInput!) {
  addPullRequestReviewThread(input: $input) {
    thread { id }
  }
}`

export const SUBMIT_REVIEW_MUTATION = `mutation SubmitReview($input: SubmitPullRequestReviewInput!) {
  submitPullRequestReview(input: $input) {
    pullRequestReview { id url state }
  }
}`

type LineOrRangeDraft = LineDraft | RangeDraft

const isLineOrRange = (d: Result['comments'][number]): d is LineOrRangeDraft => (
  d.kind === 'line' || d.kind === 'range'
)

const isFile = (d: Result['comments'][number]): d is FileDraft => d.kind === 'file'

const draftToThread = (d: LineOrRangeDraft): Record<string, unknown> => {
  if (d.kind === 'line') {
    return { path: d.path, body: d.body, line: d.line, side: d.side }
  }

  return {
    path: d.path,
    body: d.body,
    startLine: d.startLine,
    startSide: d.startSide,
    line: d.line,
    side: d.side,
  }
}

export const buildAddReviewMutation = (
  result: Result,
  prNodeId: string,
  commitOid: string,
): GraphQLCall => {
  const threads = result.comments.filter(isLineOrRange).map(draftToThread)

  return {
    query: ADD_REVIEW_MUTATION,
    variables: {
      input: {
        pullRequestId: prNodeId,
        commitOID: commitOid,
        body: result.body,
        threads,
      },
    },
  }
}

export const buildAddFileThreadMutation = (
  draft: FileDraft,
  pullRequestReviewId: string,
  commitOid: string,
): GraphQLCall => ({
  query: ADD_THREAD_MUTATION,
  variables: {
    input: {
      pullRequestReviewId,
      commitOID: commitOid,
      path: draft.path,
      body: draft.body,
      subjectType: 'FILE',
    },
  },
})

export const buildSubmitReviewMutation = (
  pullRequestReviewId: string,
  decision: ReviewDecision,
): GraphQLCall => ({
  query: SUBMIT_REVIEW_MUTATION,
  variables: {
    input: {
      pullRequestReviewId,
      event: PR_REVIEW_EVENT[decision],
    },
  },
})

export const extractFileDrafts = (result: Result): FileDraft[] => (
  result.comments.filter(isFile)
)
