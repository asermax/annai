import { runStart } from './cli/start.ts'
import { runStop } from './cli/stop.ts'
import { runStatus } from './cli/status.ts'
import { runSessions } from './cli/sessions.ts'
import { runWatch } from './cli/watch.ts'
import { runReply } from './cli/reply.ts'
import { runResult } from './cli/result.ts'
import { runSubmit } from './cli/submit.ts'

const USAGE = `usage: annai.sh <command> [args]

commands:
  start    --surface <path> --session <id> [--repo <path>] [--no-open]
  stop     --session <id>
  status   --session <id>
  sessions
  watch    --session <id>          (stream filtered events to stdout)
  result   --session <id>          (dump final result.json after submission)
  submit   --session <id>          (push review to GitHub via gh GraphQL)
  reply    (deferred to v0.3 — ask-agent threads)
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

main().catch(err => {
  const message = err instanceof Error ? err.message : String(err)
  process.stderr.write(`annai: ${message}\n`)
  process.exit(1)
})
