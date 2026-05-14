import { wantsHelp } from './output.ts'

const USAGE = `usage: annai.sh reply --session <id> --thread <thread-id> <message>

DEFERRED to v0.3 (ask-agent threads). Currently stubbed.
`

export const runReply = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }
  process.stderr.write(JSON.stringify({ error: 'deferred to v0.3 (ask-agent threads)' }) + '\n')
  process.exit(1)
}
