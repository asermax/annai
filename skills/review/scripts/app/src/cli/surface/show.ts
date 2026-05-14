import { readSurface } from '../../shared/surface-io.ts'
import type { Diff, Group, Surface } from '../../shared/surface.ts'
import { wantsHelp } from '../output.ts'
import {
  optionalBool,
  optionalStr,
  parseFlags,
  surfacePathOrDefault,
} from './args.ts'

const USAGE = `usage: annai.sh surface show [--diff <id> | --group <id>] [--text] [--surface <p>]

Read-only introspection.
  no scope flags         JSON overview: pr + tldr + per-group counts + diagrams + reviewPrompts.
  --group <id>           group details + per-diff counts.
  --diff <id>            hunks rendered with newLine numbers + that diff's annotations and suggestions.
  --text                 human-readable formatting instead of JSON.
`

const overview = (s: Surface) => ({
  pr: s.pr,
  tldr: s.tldr,
  repo: s.repo,
  groups: s.groups.map(g => ({
    id: g.id,
    kind: g.kind,
    title: g.title,
    diffCount: g.diffs.length,
    annotationCount: g.diffs.reduce((n, d) => n + d.annotations.length, 0),
    suggestionCount: g.diffs.reduce((n, d) => n + d.suggestions.length, 0),
    diagramCount: (g.diagrams ?? []).length,
  })),
  diagrams: s.diagrams ?? [],
  reviewPrompts: s.reviewPrompts ?? [],
})

const groupDetail = (g: Group) => ({
  id: g.id,
  kind: g.kind,
  title: g.title,
  intro: g.intro,
  diagrams: g.diagrams ?? [],
  diffs: g.diffs.map(d => ({
    id: d.id,
    path: d.path,
    hunkCount: d.hunks.length,
    annotationCount: d.annotations.length,
    suggestionCount: d.suggestions.length,
  })),
})

// One row per non-context line, plus context for orientation. The agent uses
// this to find usable new-file line numbers before annotation-add.
const diffDetail = (d: Diff) => ({
  id: d.id,
  path: d.path,
  hunks: d.hunks.map(h => ({
    header: h.header,
    lines: h.lines.map(l => ({
      kind: l.kind,
      oldLine: l.oldLine,
      newLine: l.newLine,
      content: l.content,
    })),
  })),
  annotations: d.annotations,
  suggestions: d.suggestions,
})

const printOverviewText = (s: Surface): void => {
  const data = overview(s)
  process.stdout.write(`PR #${data.pr.number} — ${data.pr.title}\n`)
  if (data.tldr.length > 0) process.stdout.write(`tldr: ${data.tldr}\n`)
  process.stdout.write(`groups (${data.groups.length}):\n`)
  for (const g of data.groups) {
    process.stdout.write(
      `  - ${g.id} [${g.kind}] "${g.title}" — diffs:${g.diffCount} ann:${g.annotationCount} sug:${g.suggestionCount} dia:${g.diagramCount}\n`,
    )
  }
  if (data.diagrams.length > 0) {
    process.stdout.write(`surface diagrams: ${data.diagrams.map(d => d.id).join(', ')}\n`)
  }
  if (data.reviewPrompts.length > 0) {
    process.stdout.write(`reviewPrompts (${data.reviewPrompts.length}):\n`)
    for (const p of data.reviewPrompts) process.stdout.write(`  - ${p}\n`)
  }
}

const printGroupText = (g: Group): void => {
  process.stdout.write(`group ${g.id} [${g.kind}] "${g.title}"\n`)
  if (g.intro.length > 0) process.stdout.write(`intro: ${g.intro}\n`)
  process.stdout.write(`diffs (${g.diffs.length}):\n`)
  for (const d of g.diffs) {
    process.stdout.write(
      `  - ${d.id} (${d.path}) — hunks:${d.hunks.length} ann:${d.annotations.length} sug:${d.suggestions.length}\n`,
    )
  }
}

const printDiffText = (d: Diff): void => {
  process.stdout.write(`diff ${d.id} (${d.path})\n`)
  for (const h of d.hunks) {
    process.stdout.write(`${h.header}\n`)
    for (const l of h.lines) {
      const prefix = l.kind === 'add' ? '+' : l.kind === 'del' ? '-' : ' '
      const newCol = l.newLine != null ? String(l.newLine).padStart(5) : '     '
      const oldCol = l.oldLine != null ? String(l.oldLine).padStart(5) : '     '
      process.stdout.write(`${oldCol} ${newCol} ${prefix}${l.content}\n`)
    }
  }
  if (d.annotations.length > 0) {
    process.stdout.write(`annotations (${d.annotations.length}):\n`)
    for (const a of d.annotations) {
      process.stdout.write(`  - ${a.id} [${a.kind}] L${a.lineRange[0]}–${a.lineRange[1]} "${a.title}"\n`)
    }
  }
  if (d.suggestions.length > 0) {
    process.stdout.write(`suggestions (${d.suggestions.length}):\n`)
    for (const s of d.suggestions) {
      process.stdout.write(`  - ${s.id} L${s.lineRange[0]}–${s.lineRange[1]}${s.suggestionCode != null ? ' (+code)' : ''}\n`)
    }
  }
}

const findDiff = (s: Surface, diffId: string): Diff => {
  for (const g of s.groups) {
    const d = g.diffs.find(x => x.id === diffId)
    if (d != null) return d
  }
  throw new Error(`surface show: diff "${diffId}" not found`)
}

export const runShow = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const cmd = 'surface show'
  const parsed = parseFlags(cmd, argv, {
    surface: 'value',
    diff: 'value',
    group: 'value',
    text: 'flag',
  })

  const diffId = optionalStr(parsed, 'diff')
  const groupId = optionalStr(parsed, 'group')
  if (diffId != null && groupId != null) {
    throw new Error(`${cmd}: pick one of --diff or --group`)
  }

  const surface = readSurface(surfacePathOrDefault(parsed))
  const asText = optionalBool(parsed, 'text')

  if (diffId != null) {
    const diff = findDiff(surface, diffId)
    if (asText) printDiffText(diff)
    else process.stdout.write(JSON.stringify(diffDetail(diff), null, 2) + '\n')
    return
  }

  if (groupId != null) {
    const group = surface.groups.find(g => g.id === groupId)
    if (group == null) throw new Error(`${cmd}: group "${groupId}" not found`)
    if (asText) printGroupText(group)
    else process.stdout.write(JSON.stringify(groupDetail(group), null, 2) + '\n')
    return
  }

  if (asText) printOverviewText(surface)
  else process.stdout.write(JSON.stringify(overview(surface), null, 2) + '\n')
}
