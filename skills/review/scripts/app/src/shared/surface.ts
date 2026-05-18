import { z } from 'zod'

export const ANNOTATION_KINDS = {
  pattern: 'pattern',
  note: 'note',
  question: 'question',
  'surface-check': 'surface-check',
  discrepancy: 'discrepancy',
} as const
export type AnnotationKind = typeof ANNOTATION_KINDS[keyof typeof ANNOTATION_KINDS]

export const GROUP_KINDS = {
  'base-context': 'base-context',
  'entry-point': 'entry-point',
  supporting: 'supporting',
} as const
export type GroupKind = typeof GROUP_KINDS[keyof typeof GROUP_KINDS]

export const HUNK_LINE_KINDS = {
  context: 'context',
  add: 'add',
  del: 'del',
} as const
export type HunkLineKind = typeof HUNK_LINE_KINDS[keyof typeof HUNK_LINE_KINDS]

const lineRangeSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])

export const hunkLineSchema = z.object({
  kind: z.enum(Object.values(HUNK_LINE_KINDS) as [HunkLineKind, ...HunkLineKind[]]),
  oldLine: z.number().int().nullable(),
  newLine: z.number().int().nullable(),
  content: z.string(),
})

export const hunkSchema = z.object({
  header: z.string(),
  lines: z.array(hunkLineSchema),
})

export const annotationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(Object.values(ANNOTATION_KINDS) as [AnnotationKind, ...AnnotationKind[]]),
  title: z.string(),
  body: z.string(),
  lineRange: lineRangeSchema,
})

export const suggestionSchema = z.object({
  id: z.string().min(1),
  body: z.string(),
  lineRange: lineRangeSchema,
  suggestionCode: z.string().optional(),
})

export const mermaidDiagramSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  source: z.string().min(1),
})

export const diffSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  hunks: z.array(hunkSchema),
  annotations: z.array(annotationSchema),
  suggestions: z.array(suggestionSchema),
})

export const groupSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  kind: z.enum(Object.values(GROUP_KINDS) as [GroupKind, ...GroupKind[]]),
  intro: z.string(),
  diagrams: z.array(mermaidDiagramSchema).optional(),
  diffs: z.array(diffSchema),
})

const subjectStatsSchema = z.object({
  additions: z.number().int().nonnegative(),
  deletions: z.number().int().nonnegative(),
  files: z.number().int().nonnegative(),
})

export const prSubjectSchema = z.object({
  kind: z.literal('pr'),
  url: z.string().url(),
  title: z.string().min(1),
  number: z.number().int().positive(),
  branch: z.string().min(1),
  baseBranch: z.string().min(1),
  stats: subjectStatsSchema,
})

export const localSubjectSchema = z.object({
  kind: z.literal('local'),
  title: z.string().min(1),
  branch: z.string().min(1),
  baseRef: z.string().min(1),
  stats: subjectStatsSchema,
})

export const subjectSchema = z.discriminatedUnion('kind', [
  prSubjectSchema,
  localSubjectSchema,
])

export const surfaceSchema = z.object({
  subject: subjectSchema,
  tldr: z.string(),
  repo: z.object({
    path: z.string().min(1),
  }),
  groups: z.array(groupSchema),
  diagrams: z.array(mermaidDiagramSchema).optional(),
  reviewPrompts: z.array(z.string()).optional(),
})

export type HunkLine = z.infer<typeof hunkLineSchema>
export type Hunk = z.infer<typeof hunkSchema>
export type Annotation = z.infer<typeof annotationSchema>
export type Suggestion = z.infer<typeof suggestionSchema>
export type MermaidDiagram = z.infer<typeof mermaidDiagramSchema>
export type Diff = z.infer<typeof diffSchema>
export type Group = z.infer<typeof groupSchema>
export type PrSubject = z.infer<typeof prSubjectSchema>
export type LocalSubject = z.infer<typeof localSubjectSchema>
export type Subject = z.infer<typeof subjectSchema>
export type Surface = z.infer<typeof surfaceSchema>
