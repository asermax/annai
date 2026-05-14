/**
 * Draft comments owned by the session: a discriminated union covering inline
 * line comments, multi-line range comments, and file-level comments.
 *
 * PR-level body lives separately on the session (single string), not as a
 * draft entry — it maps to `Result.body` at submission time.
 */

import { z } from 'zod'

export const DRAFT_KINDS = {
  line: 'line',
  range: 'range',
  file: 'file',
} as const
export type DraftKind = typeof DRAFT_KINDS[keyof typeof DRAFT_KINDS]

export const DIFF_SIDES = {
  LEFT: 'LEFT',
  RIGHT: 'RIGHT',
} as const
export type DiffSide = typeof DIFF_SIDES[keyof typeof DIFF_SIDES]

const diffSideSchema = z.enum([DIFF_SIDES.LEFT, DIFF_SIDES.RIGHT])

const draftBase = {
  id: z.string().min(1),
  path: z.string().min(1),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}

export const lineDraftSchema = z.object({
  ...draftBase,
  kind: z.literal(DRAFT_KINDS.line),
  line: z.number().int().positive(),
  side: diffSideSchema,
})

export const rangeDraftSchema = z.object({
  ...draftBase,
  kind: z.literal(DRAFT_KINDS.range),
  startLine: z.number().int().positive(),
  startSide: diffSideSchema,
  line: z.number().int().positive(),
  side: diffSideSchema,
})

export const fileDraftSchema = z.object({
  ...draftBase,
  kind: z.literal(DRAFT_KINDS.file),
})

export const draftSchema = z.discriminatedUnion('kind', [
  lineDraftSchema,
  rangeDraftSchema,
  fileDraftSchema,
])

export type LineDraft = z.infer<typeof lineDraftSchema>
export type RangeDraft = z.infer<typeof rangeDraftSchema>
export type FileDraft = z.infer<typeof fileDraftSchema>
export type Draft = z.infer<typeof draftSchema>

// Wire shape: POST /api/drafts — body fields without id/timestamps (server fills those).
const draftInputBase = { path: z.string().min(1), body: z.string() }

export const draftInputSchema = z.discriminatedUnion('kind', [
  z.object({ ...draftInputBase, kind: z.literal(DRAFT_KINDS.line), line: z.number().int().positive(), side: diffSideSchema }),
  z.object({ ...draftInputBase, kind: z.literal(DRAFT_KINDS.range), startLine: z.number().int().positive(), startSide: diffSideSchema, line: z.number().int().positive(), side: diffSideSchema }),
  z.object({ ...draftInputBase, kind: z.literal(DRAFT_KINDS.file) }),
])
export type DraftInput = z.infer<typeof draftInputSchema>

// PATCH /api/drafts/:id — body only.
export const draftPatchSchema = z.object({
  body: z.string(),
})
export type DraftPatch = z.infer<typeof draftPatchSchema>
