import { resolve } from 'node:path'

import { parseUnifiedDiff } from '../../shared/diff-parser.ts'
import { surfaceSchema, type Diff, type Subject, type Surface } from '../../shared/surface.ts'

const slugify = (path: string): string => {
  const s = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return s.length > 0 ? s : 'file'
}

const uniqueDiffId = (path: string, taken: Set<string>): string => {
  const base = `diff-${slugify(path)}`
  if (!taken.has(base)) {
    taken.add(base)
    return base
  }
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`
    if (!taken.has(candidate)) {
      taken.add(candidate)
      return candidate
    }
  }
}

export const computeDiffStats = (diffs: Diff[]): { additions: number, deletions: number, files: number } => {
  let additions = 0
  let deletions = 0
  for (const d of diffs) {
    for (const h of d.hunks) {
      for (const l of h.lines) {
        if (l.kind === 'add') additions++
        else if (l.kind === 'del') deletions++
      }
    }
  }
  return { additions, deletions, files: diffs.length }
}

export const parseDiffsFromText = (diffText: string): Diff[] => {
  const files = parseUnifiedDiff(diffText)
  const takenIds = new Set<string>()
  return files.map(f => ({
    id: uniqueDiffId(f.path, takenIds),
    path: f.path,
    hunks: f.hunks,
    annotations: [],
    suggestions: [],
  }))
}

export const buildSurfaceFromDiffs = (subject: Subject, diffs: Diff[], repoPath: string): Surface => {
  const surface: Surface = {
    subject,
    tldr: '',
    repo: { path: resolve(repoPath) },
    groups: [
      {
        id: 'unsorted',
        kind: 'supporting',
        title: '(unsorted — regroup me)',
        intro: '',
        diffs,
      },
    ],
    diagrams: [],
    reviewPrompts: [],
  }

  return surfaceSchema.parse(surface)
}
