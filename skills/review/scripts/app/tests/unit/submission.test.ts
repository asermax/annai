import { describe, it, expect } from 'vitest'

import {
  buildAddReviewMutation,
  buildAddFileThreadMutation,
  buildSubmitReviewMutation,
  extractFileDrafts,
} from '../../src/daemon/submission.ts'
import type { Result } from '../../src/shared/result.ts'
import type { FileDraft, LineDraft, RangeDraft } from '../../src/shared/drafts.ts'

const lineDraft: LineDraft = {
  id: 'l1', kind: 'line', path: 'src/foo.ts', line: 42, side: 'RIGHT', body: 'nit: rename',
  createdAt: '2026-05-13T00:00:00Z', updatedAt: '2026-05-13T00:00:00Z',
}

const rangeDraft: RangeDraft = {
  id: 'r1', kind: 'range', path: 'src/bar.ts',
  startLine: 10, startSide: 'RIGHT', line: 14, side: 'RIGHT',
  body: 'this block can be a map',
  createdAt: '2026-05-13T00:00:00Z', updatedAt: '2026-05-13T00:00:00Z',
}

const fileDraft: FileDraft = {
  id: 'f1', kind: 'file', path: 'src/baz.ts', body: 'this whole file needs love',
  createdAt: '2026-05-13T00:00:00Z', updatedAt: '2026-05-13T00:00:00Z',
}

const mixedResult: Result = {
  decision: 'comment',
  body: 'Overall thoughts here.',
  comments: [lineDraft, rangeDraft, fileDraft],
}

describe('submission builders', () => {
  it('buildAddReviewMutation embeds line + range drafts as threads, drops file-level', () => {
    const call = buildAddReviewMutation(mixedResult, 'PR_NODE_ID', 'commit-sha')

    expect(call.query).toMatch(/AddPullRequestReviewInput/)
    const input = call.variables.input as Record<string, unknown>
    expect(input.pullRequestId).toBe('PR_NODE_ID')
    expect(input.commitOID).toBe('commit-sha')
    expect(input.body).toBe('Overall thoughts here.')

    const threads = input.threads as Array<Record<string, unknown>>
    expect(threads).toHaveLength(2)
    expect(threads[0]).toEqual({ path: 'src/foo.ts', body: 'nit: rename', line: 42, side: 'RIGHT' })
    expect(threads[1]).toEqual({
      path: 'src/bar.ts',
      body: 'this block can be a map',
      startLine: 10,
      startSide: 'RIGHT',
      line: 14,
      side: 'RIGHT',
    })
  })

  it('extractFileDrafts returns only file-kind comments', () => {
    expect(extractFileDrafts(mixedResult)).toEqual([fileDraft])
  })

  it('buildAddFileThreadMutation attaches subjectType: FILE to the pending review', () => {
    const call = buildAddFileThreadMutation(fileDraft, 'REVIEW_ID', 'commit-sha')

    expect(call.query).toMatch(/AddPullRequestReviewThreadInput/)
    expect(call.variables.input).toEqual({
      pullRequestReviewId: 'REVIEW_ID',
      commitOID: 'commit-sha',
      path: 'src/baz.ts',
      body: 'this whole file needs love',
      subjectType: 'FILE',
    })
  })

  it('buildSubmitReviewMutation maps approve → APPROVE and comment → COMMENT', () => {
    expect((buildSubmitReviewMutation('R', 'approve').variables.input as Record<string, unknown>).event).toBe('APPROVE')
    expect((buildSubmitReviewMutation('R', 'comment').variables.input as Record<string, unknown>).event).toBe('COMMENT')
  })

  it('empty Result yields empty threads array and empty body', () => {
    const empty: Result = { decision: 'approve', body: '', comments: [] }
    const call = buildAddReviewMutation(empty, 'P', 'C')
    const input = call.variables.input as Record<string, unknown>
    expect(input.body).toBe('')
    expect(input.threads).toEqual([])
  })

  it('only-file Result still produces a valid addPullRequestReview (empty threads)', () => {
    const onlyFile: Result = { decision: 'comment', body: 'x', comments: [fileDraft] }
    const call = buildAddReviewMutation(onlyFile, 'P', 'C')
    const input = call.variables.input as Record<string, unknown>
    expect(input.threads).toEqual([])
  })
})
