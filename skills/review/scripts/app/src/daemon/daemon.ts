import { existsSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sessionPaths } from '../shared/paths.ts'
import { EventBus } from './events.ts'
import { startIpcServer } from './ipc.ts'
import type { CommandPayload, CommandResponse } from './ipc.ts'
import { startHttpServer } from './http.ts'
import { Session, loadSurface, writeStateAtomic, appendEventLog } from './session.ts'
import type { AnnaiEvent } from '../shared/events.ts'

const here = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = resolve(here, '../frontend')  // dist/daemon → dist/frontend

const parseArgs = (argv: string[]): { sessionId: string } => {
  let sessionId: string | undefined
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--session' && i + 1 < argv.length) {
      sessionId = argv[i + 1]
      i++
    }
  }
  if (sessionId == null) throw new Error('daemon: --session <id> is required')

  return { sessionId }
}

const main = async (): Promise<void> => {
  const { sessionId } = parseArgs(process.argv.slice(2))
  const paths = sessionPaths(sessionId)

  const surface = loadSurface(paths.surface)
  const session = new Session({ sessionId, surface })

  const bus = new EventBus()

  bus.subscribe(event => {
    appendEventLog(paths.events, event)
  })

  // start http first so we know the port to publish in state.json
  const { server: httpServer, port } = await startHttpServer({
    frontendDir: FRONTEND_DIR,
    surface,
  })
  session.setPort(port)
  writeStateAtomic(paths.state, session.snapshot())

  // pre-empty stale socket file (from a crashed prior session)
  if (existsSync(paths.sock)) unlinkSync(paths.sock)

  const shutdown = async (reason: string): Promise<void> => {
    const ev: AnnaiEvent = { kind: 'session-aborted', at: new Date().toISOString(), reason }
    try { bus.emit(ev) } catch { /* best effort */ }
    try { httpServer.close() } catch { /* */ }
    try { ipcServer.close() } catch { /* */ }
    try { if (existsSync(paths.sock)) unlinkSync(paths.sock) } catch { /* */ }
    // session dir is left intact for `annai sessions` to mark stale; `stop` removes it.
    process.exit(0)
  }

  const ipcServer = await startIpcServer({
    socketPath: paths.sock,
    onCommand: async (cmd: CommandPayload): Promise<CommandResponse> => {
      switch (cmd.op) {
        case 'ping':
          return { ok: true, data: { sessionId, port } }
        case 'status':
          return { ok: true, data: session.snapshot() }
        case 'stop':
          // schedule shutdown but reply first
          setImmediate(() => { shutdown('stop-command').catch(() => process.exit(1)) })
          return { ok: true, data: { stopping: true } }
        case 'reply':
        case 'result':
          return { ok: false, error: `command "${cmd.op}" not implemented in v0.1` }
        default: {
          const exhaustive: never = cmd
          return { ok: false, error: `unknown command: ${JSON.stringify(exhaustive)}` }
        }
      }
    },
    onWatch: () => {
      // v0.1: the subscription is wired but no events flow to the agent.
      // v0.2 replaces the no-op forwarder with `socket.write(encodeFrame(event))`.
      return bus.subscribe(() => { /* no-op forwarder for v0.1 */ }, { watchFilter: true })
    },
  })

  bus.emit({ kind: 'session-started', at: new Date().toISOString(), sessionId, port })

  // graceful signals
  process.on('SIGTERM', () => { void shutdown('SIGTERM') })
  process.on('SIGINT', () => { void shutdown('SIGINT') })

  // keep process alive — servers do that on their own
}

main().catch(err => {
  console.error('daemon error:', err instanceof Error ? err.stack ?? err.message : String(err))
  process.exit(1)
})
