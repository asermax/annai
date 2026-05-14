import { sessionPaths } from '../shared/paths.ts'
import { sendCommand } from './ipc-client.ts'
import { wantsHelp } from './output.ts'

const USAGE = `usage: annai.sh result --session <id>

Dumps result.json from the daemon after the review has been submitted.
Errors if no submission has happened yet.
`

const parseArgs = (argv: string[]): { sessionId: string } => {
  let sessionId: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session' && i + 1 < argv.length) { sessionId = argv[i + 1]; i++; continue }
    throw new Error(`result: unknown argument "${arg}"`)
  }
  if (sessionId == null) throw new Error('result: --session <id> is required')

  return { sessionId }
}

export const runResult = async (argv: string[]): Promise<void> => {
  if (wantsHelp(argv)) { process.stdout.write(USAGE); return }
  const { sessionId } = parseArgs(argv)
  const paths = sessionPaths(sessionId)

  const response = await sendCommand(paths.sock, { op: 'result' }, 3000)
  if (!response.ok) throw new Error(`result: ${response.error ?? 'unknown error'}`)

  process.stdout.write(JSON.stringify(response.data, null, 2) + '\n')
}
