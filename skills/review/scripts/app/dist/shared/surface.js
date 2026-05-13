import { z } from 'zod';
export const ANNOTATION_KINDS = {
    pattern: 'pattern',
    note: 'note',
    question: 'question',
    'surface-check': 'surface-check',
    discrepancy: 'discrepancy',
};
export const GROUP_KINDS = {
    'base-context': 'base-context',
    'entry-point': 'entry-point',
    supporting: 'supporting',
};
export const HUNK_LINE_KINDS = {
    context: 'context',
    add: 'add',
    del: 'del',
};
const lineRangeSchema = z.tuple([z.number().int().nonnegative(), z.number().int().nonnegative()]);
export const hunkLineSchema = z.object({
    kind: z.enum(Object.values(HUNK_LINE_KINDS)),
    oldLine: z.number().int().nullable(),
    newLine: z.number().int().nullable(),
    content: z.string(),
});
export const hunkSchema = z.object({
    header: z.string(),
    lines: z.array(hunkLineSchema),
});
export const annotationSchema = z.object({
    id: z.string().min(1),
    kind: z.enum(Object.values(ANNOTATION_KINDS)),
    title: z.string(),
    body: z.string(),
    lineRange: lineRangeSchema,
});
export const suggestionSchema = z.object({
    id: z.string().min(1),
    body: z.string(),
    lineRange: lineRangeSchema,
    suggestionCode: z.string().optional(),
});
export const mermaidDiagramSchema = z.object({
    id: z.string().min(1),
    title: z.string().optional(),
    source: z.string().min(1),
});
export const diffSchema = z.object({
    id: z.string().min(1),
    path: z.string().min(1),
    hunks: z.array(hunkSchema),
    annotations: z.array(annotationSchema),
    suggestions: z.array(suggestionSchema),
});
export const groupSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(Object.values(GROUP_KINDS)),
    intro: z.string(),
    diagrams: z.array(mermaidDiagramSchema).optional(),
    diffs: z.array(diffSchema),
});
export const prMetaSchema = z.object({
    url: z.string().url(),
    title: z.string().min(1),
    number: z.number().int().positive(),
    branch: z.string().min(1),
    baseBranch: z.string().min(1),
    stats: z.object({
        additions: z.number().int().nonnegative(),
        deletions: z.number().int().nonnegative(),
        files: z.number().int().nonnegative(),
    }),
});
export const surfaceSchema = z.object({
    pr: prMetaSchema,
    tldr: z.string(),
    repo: z.object({
        path: z.string().min(1),
    }),
    groups: z.array(groupSchema),
    diagrams: z.array(mermaidDiagramSchema).optional(),
    reviewPrompts: z.array(z.string()).optional(),
});
//# sourceMappingURL=surface.js.map