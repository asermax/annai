import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'

import { parseUnifiedDiff } from '../../shared/diff-parser.ts'
import { surfaceSchema, type Diff, type Surface } from '../../shared/surface.ts'

export interface ScaffoldArgs {
  pr: number
  repo: string
  out?: string
  diffPath?: string
  metaPath?: string
}

export const parseScaffoldArgs = (argv: string[]): ScaffoldArgs => {
  let pr: number | undefined
  let repo: string | undefined
  let out: string | undefined
  let diffPath: string | undefined
  let metaPath: string | undefined

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--pr' && i + 1 < argv.length) { pr = Number(argv[i + 1]); i++; continue }
    if (arg === '--repo' && i + 1 < argv.length) { repo = argv[i + 1]; i++; continue }
    if (arg === '--out' && i + 1 < argv.length) { out = argv[i + 1]; i++; continue }
    if (arg === '--diff' && i + 1 < argv.length) { diffPath = argv[i + 1]; i++; continue }
    if (arg === '--meta' && i + 1 < argv.length) { metaPath = argv[i + 1]; i++; continue }
    throw new Error(`surface scaffold: unknown argument "${arg}"`)
  }

  if (pr == null || !Number.isFinite(pr) || pr <= 0) throw new Error('surface scaffold: --pr <number> is required')
  if (repo == null) throw new Error('surface scaffold: --repo <path> is required')

  return { pr, repo, out, diffPath, metaPath }
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

const runGh = (args: string[]): Promise<string> => {
  return new Promise((resolveOuter, rejectOuter) => {
    const child = spawn('gh', args, { stdio: ['ignore', 'pipe', 'pipe'] })

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

const fetchMeta = async (args: ScaffoldArgs): Promise<PRViewJson> => {
  if (args.metaPath != null) {
    return JSON.parse(readFileSync(args.metaPath, 'utf8')) as PRViewJson
  }
  const json = await runGh([
    'pr', 'view', String(args.pr),
    '--repo', args.repo,
    '--json', 'number,title,url,headRefName,baseRefName,additions,deletions,changedFiles',
  ])
  return JSON.parse(json) as PRViewJson
}

const fetchDiff = async (args: ScaffoldArgs): Promise<string> => {
  if (args.diffPath != null) {
    return readFileSync(args.diffPath, 'utf8')
  }
  return runGh(['pr', 'diff', String(args.pr), '--repo', args.repo])
}

export const runScaffold = async (argv: string[]): Promise<void> => {
  const args = parseScaffoldArgs(argv)

  const [meta, diffText] = await Promise.all([fetchMeta(args), fetchDiff(args)])
  const surface = buildScaffold(meta, diffText, args.repo)

  const json = JSON.stringify(surface, null, 2) + '\n'
  if (args.out != null) {
    writeFileSync(args.out, json, 'utf8')
  } else {
    process.stdout.write(json)
  }
}
