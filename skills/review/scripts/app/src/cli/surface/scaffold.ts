import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { parseUnifiedDiff } from '../../shared/diff-parser.ts'
import { surfaceSchema, type Diff, type Surface } from '../../shared/surface.ts'
import { emitResult, wantsHelp } from '../output.ts'
import type { OutputMode } from '../output.ts'

const USAGE = `usage: annai.sh surface scaffold --pr <n> --repo <path | OWNER/REPO> [--out <file>] [--diff <file>] [--meta <file>] [--json | --quiet]

Builds a hunks-parsed surface skeleton from a real PR. --repo accepts either
a GitHub OWNER/REPO slug or a local clone path (the slug is resolved via
"gh repo view --json nameWithOwner" in that directory).
Pass --diff / --meta to feed unified-diff text and gh-view JSON from local
files instead of shelling out to gh (used by tests).

When --out is omitted, the JSON surface is written to stdout; success
messages are suppressed in that mode so the output stays machine-parseable.
`

export interface ScaffoldArgs {
  pr: number
  repo: string
  out?: string
  diffPath?: string
  metaPath?: string
  outputMode: OutputMode
}

export const parseScaffoldArgs = (argv: string[]): ScaffoldArgs => {
  let pr: number | undefined
  let repo: string | undefined
  let out: string | undefined
  let diffPath: string | undefined
  let metaPath: string | undefined
  let json = false
  let quiet = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--pr' && i + 1 < argv.length) { pr = Number(argv[i + 1]); i++; continue }
    if (arg === '--repo' && i + 1 < argv.length) { repo = argv[i + 1]; i++; continue }
    if (arg === '--out' && i + 1 < argv.length) { out = argv[i + 1]; i++; continue }
    if (arg === '--diff' && i + 1 < argv.length) { diffPath = argv[i + 1]; i++; continue }
    if (arg === '--meta' && i + 1 < argv.length) { metaPath = argv[i + 1]; i++; continue }
    if (arg === '--json') { json = true; continue }
    if (arg === '--quiet') { quiet = true; continue }
    throw new Error(`surface scaffold: unknown argument "${arg}"`)
  }

  if (pr == null || !Number.isFinite(pr) || pr <= 0) throw new Error('surface scaffold: --pr <number> is required')
  if (repo == null) throw new Error('surface scaffold: --repo <path or OWNER/REPO> is required')

  return { pr, repo, out, diffPath, metaPath, outputMode: { json, quiet } }
}

// gh pr view JSON shape we ask for. Anything not on this list isn't read.
interface PRViewJson {
  number: number
  title: string
  url: string
  headRefName: string
  baseRefName: string
  additions: number
  deletions: number
  changedFiles: number
}

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

export const buildScaffold = (meta: PRViewJson, diffText: string, repoPath: string): Surface => {
  const files = parseUnifiedDiff(diffText)

  const takenIds = new Set<string>()
  const diffs: Diff[] = files.map(f => ({
    id: uniqueDiffId(f.path, takenIds),
    path: f.path,
    hunks: f.hunks,
    annotations: [],
    suggestions: [],
  }))

  const surface: Surface = {
    pr: {
      url: meta.url,
      title: meta.title,
      number: meta.number,
      branch: meta.headRefName,
      baseBranch: meta.baseRefName,
      stats: {
        additions: meta.additions,
        deletions: meta.deletions,
        files: meta.changedFiles,
      },
    },
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

  // Catch parser/scaffolder regressions before emitting.
  return surfaceSchema.parse(surface)
}

interface GhProcessOptions {
  cwd?: string
}

const runGh = (args: string[], opts: GhProcessOptions = {}): Promise<string> => {
  return new Promise((resolveOuter, rejectOuter) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], cwd: opts.cwd })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('error', err => rejectOuter(err))
    child.on('close', code => {
      if (code === 0) resolveOuter(stdout)
      else rejectOuter(new Error(`gh ${args.join(' ')} failed (exit ${code}): ${stderr.trim() || stdout.trim()}`))
    })
  })
}

// OWNER/REPO matches host-prefixed slugs too ("github.com/owner/repo")
// — gh accepts both.
const SLUG_PATTERN = /^[\w.-]+\/[\w.-]+(?:\/[\w.-]+)?$/

const isLocalDirectory = (value: string): boolean => {
  try {
    return statSync(value).isDirectory()
  } catch {
    return false
  }
}

// Resolves --repo to the slug `gh` needs while keeping the original value
// available for the surface's repo.path field when it was a directory.
export const resolveRepoSlug = async (repo: string): Promise<string> => {
  if (SLUG_PATTERN.test(repo) && !isLocalDirectory(repo)) {
    return repo
  }

  if (!isLocalDirectory(repo)) {
    throw new Error(
      `surface scaffold: --repo "${repo}" is not a directory and is not in OWNER/REPO form`,
    )
  }

  try {
    const out = await runGh(['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { cwd: repo })
    const slug = out.trim()
    if (slug.length === 0) {
      throw new Error('empty slug')
    }
    return slug
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new Error(
      `surface scaffold: could not resolve OWNER/REPO from directory "${repo}": ${reason}`,
    )
  }
}

const fetchMeta = async (args: ScaffoldArgs, slug: string): Promise<PRViewJson> => {
  if (args.metaPath != null) {
    return JSON.parse(readFileSync(args.metaPath, 'utf8')) as PRViewJson
  }
  const json = await runGh([
    'pr', 'view', String(args.pr),
    '--repo', slug,
    '--json', 'number,title,url,headRefName,baseRefName,additions,deletions,changedFiles',
  ])
  return JSON.parse(json) as PRViewJson
}

const fetchDiff = async (args: ScaffoldArgs, slug: string): Promise<string> => {
  if (args.diffPath != null) {
    return readFileSync(args.diffPath, 'utf8')
  }
  return runGh(['pr', 'diff', String(args.pr), '--repo', slug])
}

const countDiffs = (s: Surface): { diffs: number, groups: number } => ({
  diffs: s.groups.reduce((n, g) => n + g.diffs.length, 0),
  groups: s.groups.length,
})

export const runScaffold = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const args = parseScaffoldArgs(argv)

  // Only resolve a slug via gh when we actually need to call gh — local
  // --diff / --meta inputs skip the network entirely (the test path).
  const needsSlug = args.metaPath == null || args.diffPath == null
  const slug = needsSlug ? await resolveRepoSlug(args.repo) : args.repo

  const [meta, diffText] = await Promise.all([fetchMeta(args, slug), fetchDiff(args, slug)])

  // Pass the original --repo (typically a local path) so the daemon can find
  // the working tree later; the slug is only used to drive gh.
  const surface = buildScaffold(meta, diffText, args.repo)

  const json = JSON.stringify(surface, null, 2) + '\n'
  if (args.out != null) {
    writeFileSync(args.out, json, 'utf8')
    const counts = countDiffs(surface)
    emitResult({
      op: 'scaffold',
      surface: args.out,
      text: `scaffold wrote ${counts.diffs} diff(s) across ${counts.groups} group → ${args.out}`,
      data: { ...counts, slug, pr: args.pr, out: args.out },
    }, args.outputMode)
    return
  }

  // No --out: the surface IS the result. Don't add a sidecar success line
  // that would corrupt parseable stdout.
  process.stdout.write(json)
}
