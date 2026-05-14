import { readSurface } from '../../shared/surface-io.ts'
import { emitResult, wantsHelp } from '../output.ts'
import {
  extractOutputMode,
  optionalBool,
  parseFlags,
  surfacePathOrDefault,
  withOutputFlags,
} from './args.ts'

const USAGE = `usage: annai.sh surface validate [--strict] [--surface <p>] [--json | --quiet]

Re-validates surface.json against the schema. Useful after a hand-edit.
With --strict, also fails on:
  - non-empty "unsorted" group still present
  - groups with an empty intro
  - empty surface-level tldr
`

interface SurfaceCounts {
  groups: number
  diffs: number
  annotations: number
  suggestions: number
  diagrams: number
}

const countSurface = (path: string): SurfaceCounts => {
  const surface = readSurface(path)

  let diffs = 0
  let annotations = 0
  let suggestions = 0
  let diagrams = (surface.diagrams ?? []).length

  for (const group of surface.groups) {
    diffs += group.diffs.length
    diagrams += (group.diagrams ?? []).length
    for (const diff of group.diffs) {
      annotations += diff.annotations.length
      suggestions += diff.suggestions.length
    }
  }

  return { groups: surface.groups.length, diffs, annotations, suggestions, diagrams }
}

const strictCheck = (path: string): string[] => {
  const surface = readSurface(path)
  const issues: string[] = []

  const unsorted = surface.groups.find(g => g.id === 'unsorted')
  if (unsorted != null && unsorted.diffs.length > 0) {
    issues.push(`unsorted group still owns ${unsorted.diffs.length} diff(s)`)
  }

  for (const g of surface.groups) {
    if (g.intro.trim().length === 0) {
      issues.push(`group "${g.id}" has an empty intro`)
    }
  }

  if (surface.tldr.trim().length === 0) {
    issues.push('surface tldr is empty')
  }

  return issues
}

export const runValidate = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface validate'
  const parsed = parseFlags(cmd, argv, withOutputFlags({
    surface: 'value',
    strict: 'flag',
  }))

  const surfacePath = surfacePathOrDefault(parsed)
  const strict = optionalBool(parsed, 'strict')
  const mode = extractOutputMode(parsed)

  // Always run the base zod validation first. This throws on schema errors,
  // which the outer CLI runner reports.
  const counts = countSurface(surfacePath)

  if (strict) {
    const issues = strictCheck(surfacePath)
    if (issues.length > 0) {
      if (mode.json) {
        process.stdout.write(JSON.stringify({
          ok: false,
          op: 'validate',
          surface: surfacePath,
          error: { message: 'strict checks failed', issues },
        }) + '\n')
      } else {
        process.stderr.write(`annai: surface FAILED strict checks\n`)
        for (const issue of issues) process.stderr.write(`  ${issue}\n`)
      }
      process.exit(1)
    }
  }

  emitResult({
    op: 'validate',
    surface: surfacePath,
    text: `surface OK (${counts.groups} groups, ${counts.diffs} diffs, ${counts.annotations} annotations, ${counts.suggestions} suggestions, ${counts.diagrams} diagrams)${strict ? ' [strict]' : ''}`,
    data: { ...counts, strict },
  }, mode)
}
