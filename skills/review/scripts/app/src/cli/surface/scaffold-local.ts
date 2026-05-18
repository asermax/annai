import { readFileSync, statSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

import type { LocalSubject, Surface } from '../../shared/surface.ts'
import { emitResult, wantsHelp } from '../output.ts'
import type { OutputMode } from '../output.ts'
import { buildSurfaceFromDiffs, computeDiffStats, parseDiffsFromText } from './scaffold-build.ts'

const USAGE = `usage: annai.sh surface scaffold-local --repo <path> --diff <file> --title <string> [--branch <name>] [--base-ref <spec>] [--out <file>] [--json | --quiet]

Builds a hunks-parsed surface skeleton from a local change (no GitHub).
The agent runs the appropriate "git diff …" itself and feeds the result
via --diff; this op does no git/gh shell-out for diff data.

  --repo       local clone path; recorded as surface.repo.path.
  --diff       unified-diff text the agent produced via git diff.
  --title      short subject title (~60 chars; what the change is).
  --branch     optional; defaults to "git rev-parse --abbrev-ref HEAD" in --repo.
  --base-ref   optional spec recorded as subject metadata (e.g. "HEAD", "main",
               "origin/main"). Defaults to "HEAD".

When --out is omitted, the JSON surface is written to stdout; success
messages are suppressed in that mode so the output stays machine-parseable.
`

export interface ScaffoldLocalArgs {
  repo: string
  diffPath: string
  title: string
  branch?: string
  baseRef?: string
  out?: string
  outputMode: OutputMode
}

export const parseScaffoldLocalArgs = (argv: string[]): ScaffoldLocalArgs => {
  let repo: string | undefined
  let diffPath: string | undefined
  let title: string | undefined
  let branch: string | undefined
  let baseRef: string | undefined
  let out: string | undefined
  let json = false
  let quiet = false

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--repo' && i + 1 < argv.length) { repo = argv[i + 1]; i++; continue }
    if (arg === '--diff' && i + 1 < argv.length) { diffPath = argv[i + 1]; i++; continue }
    if (arg === '--title' && i + 1 < argv.length) { title = argv[i + 1]; i++; continue }
    if (arg === '--branch' && i + 1 < argv.length) { branch = argv[i + 1]; i++; continue }
    if (arg === '--base-ref' && i + 1 < argv.length) { baseRef = argv[i + 1]; i++; continue }
    if (arg === '--out' && i + 1 < argv.length) { out = argv[i + 1]; i++; continue }
    if (arg === '--json') { json = true; continue }
    if (arg === '--quiet') { quiet = true; continue }
    throw new Error(`surface scaffold-local: unknown argument "${arg}"`)
  }

  if (repo == null) throw new Error('surface scaffold-local: --repo <path> is required')
  if (diffPath == null) throw new Error('surface scaffold-local: --diff <file> is required')
  if (title == null || title.trim().length === 0) {
    throw new Error('surface scaffold-local: --title <string> is required')
  }

  return { repo, diffPath, title, branch, baseRef, out, outputMode: { json, quiet } }
}

const isLocalDirectory = (value: string): boolean => {
  try {
    return statSync(value).isDirectory()
  } catch {
    return false
  }
}

const runGit = (args: string[], cwd: string): Promise<string> => {
  return new Promise((resolveOuter, rejectOuter) => {
    const child = spawn('git', args, { stdio: ['ignore', 'pipe', 'pipe'], cwd })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', d => { stdout += d.toString() })
    child.stderr.on('data', d => { stderr += d.toString() })
    child.on('error', err => rejectOuter(err))
    child.on('close', code => {
      if (code === 0) resolveOuter(stdout.trim())
      else rejectOuter(new Error(`git ${args.join(' ')} failed (exit ${code}): ${stderr.trim() || stdout.trim()}`))
    })
  })
}

const resolveBranch = async (args: ScaffoldLocalArgs): Promise<string> => {
  if (args.branch != null && args.branch.length > 0) return args.branch
  try {
    const out = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], args.repo)
    if (out.length === 0 || out === 'HEAD') return 'detached'
    return out
  } catch {
    return 'detached'
  }
}

export const buildLocalScaffold = (
  diffText: string,
  repoPath: string,
  title: string,
  branch: string,
  baseRef: string,
): Surface => {
  const diffs = parseDiffsFromText(diffText)
  const subject: LocalSubject = {
    kind: 'local',
    title,
    branch,
    baseRef,
    stats: computeDiffStats(diffs),
  }
  return buildSurfaceFromDiffs(subject, diffs, repoPath)
}

const countDiffs = (s: Surface): { diffs: number, groups: number } => ({
  diffs: s.groups.reduce((n, g) => n + g.diffs.length, 0),
  groups: s.groups.length,
})

export const runScaffoldLocal = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }

  const args = parseScaffoldLocalArgs(argv)

  if (!isLocalDirectory(args.repo)) {
    throw new Error(`surface scaffold-local: --repo "${args.repo}" is not a directory`)
  }

  const diffText = readFileSync(args.diffPath, 'utf8')
  const branch = await resolveBranch(args)
  const baseRef = args.baseRef ?? 'HEAD'

  const surface = buildLocalScaffold(diffText, args.repo, args.title, branch, baseRef)

  const json = JSON.stringify(surface, null, 2) + '\n'
  if (args.out != null) {
    writeFileSync(args.out, json, 'utf8')
    const counts = countDiffs(surface)
    emitResult({
      op: 'scaffold-local',
      surface: args.out,
      text: `scaffold-local wrote ${counts.diffs} diff(s) across ${counts.groups} group → ${args.out}`,
      data: { ...counts, branch, baseRef, title: args.title, out: args.out },
    }, args.outputMode)
    return
  }

  process.stdout.write(json)
}
