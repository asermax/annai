import { createConnection } from 'node:net'

import { sessionPaths } from '../shared/paths.ts'
import { encodeFrame, createFrameDecoder } from '../daemon/ipc.ts'
import type { AnnaiEvent } from '../shared/events.ts'

const parseArgs = (argv: string[]): { sessionId: string } => {
  let sessionId: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session' && i + 1 < argv.length) { sessionId = argv[i + 1]; i++; continue }
    throw new Error(`watch: unknown argument "${arg}"`)
  }
  if (sessionId == null) throw new Error('watch: --session <id> is required')

  return { sessionId }
}

const TERMINAL_KINDS: ReadonlySet<AnnaiEvent['kind']> = new Set<AnnaiEvent['kind']>([
  'review-submitted',
  'session-aborted',
])

export const runWatch = async (argv: string[]): Promise<void> => {
  const { sessionId } = parseArgs(argv)
  const paths = sessionPaths(sessionId)

  await new Promise<void>((resolveOuter, rejectOuter) => {
    const socket = createConnection(paths.sock)
    const decoder = createFrameDecoder()
    let settled = false

    const settle = (err?: Error): void => {
      if (settled) return
      settled = true
      try { socket.end() } catch { /* */ }
      if (err != null) rejectOuter(err)
      else resolveOuter()
    }

    socket.on('connect', () => {
      socket.write(encodeFrame({ kind: 'watch' }))
    })

    socket.on('data', chunk => {
      decoder.push(chunk)
      for (const frame of decoder.drain()) {
        const event = frame as AnnaiEvent
        process.stdout.write(JSON.stringify(event) + '\n')
        if (TERMINAL_KINDS.has(event.kind)) {
          // give stdout a tick to flush, then close
          setImmediate(() => settle())
        }
      }
    })

    socket.on('error', err => settle(err))
    socket.on('close', () => settle())
  })
}
