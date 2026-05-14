import { ZodError } from 'zod'

import { runStart } from './cli/start.ts'
import { runStop } from './cli/stop.ts'
import { runStatus } from './cli/status.ts'
import { runSessions } from './cli/sessions.ts'
import { runWatch } from './cli/watch.ts'
import { runReply } from './cli/reply.ts'
import { runResult } from './cli/result.ts'
import { runSubmit } from './cli/submit.ts'
import { runSurface } from './cli/surface.ts'

const USAGE = `usage: annai.sh <command> [args]

commands:
  start    --surface <path> --session <id> [--repo <path>] [--no-open]
  stop     --session <id>
  status   --session <id>
  sessions
  watch    --session <id>          (stream filtered events to stdout)
  result   --session <id>          (dump final result.json after submission)
  submit   --session <id>          (push review to GitHub via gh GraphQL)
  surface  <op> [args]             (author surface.json: scaffold, group-add, diff-move, annotation-add, ...)
  reply    (deferred to v0.3 — ask-agent threads)

Run \`annai.sh surface\` with no args for the full list of surface ops.
`

type Handler = (argv: string[]) => Promise<void>

const HANDLERS: Record<string, Handler> = {
  start: runStart,
  stop: runStop,
  status: runStatus,
  sessions: runSessions,
  watch: runWatch,
  reply: runReply,
  result: runResult,
  submit: runSubmit,
  surface: runSurface,
}

const main = async (): Promise<void> => {
  const [, , subcommand, ...rest] = process.argv

  if (subcommand == null || subcommand === '-h' || subcommand === '--help') {
    process.stdout.write(USAGE)
    return
  }

  const handler = HANDLERS[subcommand]
  if (handler == null) {
    process.stderr.write(`annai: unknown command "${subcommand}"\n\n${USAGE}`)
    process.exit(1)
  }

  await handler(rest)
}

// Format a zod issue path like ["groups", 0, "diffs", 1, "kind"] as a
// JSON-pointer-ish string ("groups[0].diffs[1].kind") so the agent can
// target a specific field directly.
const formatZodPath = (path: readonly (string | number)[]): string => {
  let out = ''
  for (const segment of path) {
    if (typeof segment === 'number') {
      out += `[${segment}]`
    } else {
      out += out === '' ? segment : `.${segment}`
    }
  }
  return out === '' ? '<root>' : out
}

const formatZodError = (err: ZodError): string => {
  const lines = err.issues
    .map(issue => `  ${formatZodPath(issue.path)}: ${issue.message}`)
    .sort()
  return `annai: surface validation failed\n${lines.join('\n')}\n`
}

main().catch(err => {
  if (err instanceof ZodError) {
    process.stderr.write(formatZodError(err))
    process.exit(1)
  }
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`annai: ${message}\n`)
  process.exit(1)
})
