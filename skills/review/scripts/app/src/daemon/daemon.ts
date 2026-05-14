import { existsSync, unlinkSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sessionPaths } from '../shared/paths.ts'
import { EventBus } from './events.ts'
import { startIpcServer, encodeFrame } from './ipc.ts'
import type { CommandPayload, CommandResponse } from './ipc.ts'
import { startHttpServer } from './http.ts'
import { Session, loadSurface, appendEventLog } from './session.ts'
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
  const session = new Session({ sessionId, surface, statePath: paths.state })

  const bus = new EventBus()

  bus.subscribe(event => {
    appendEventLog(paths.events, event)
  })

  // pre-empty stale socket file (from a crashed prior session)
  if (existsSync(paths.sock)) unlinkSync(paths.sock)

  let shutdownPromise: Promise<void> | null = null
  const shutdown = (reason: string): Promise<void> => {
    if (shutdownPromise != null) return shutdownPromise

    shutdownPromise = (async () => {
      const ev: AnnaiEvent = { kind: 'session-aborted', at: new Date().toISOString(), reason }
      try { bus.emit(ev) } catch { /* best effort */ }
      try { httpServer.close() } catch { /* */ }
      try { ipcServer.close() } catch { /* */ }
      try { if (existsSync(paths.sock)) unlinkSync(paths.sock) } catch { /* */ }
      // give pending IPC writes a tick to flush before exit
      setImmediate(() => process.exit(0))
    })()

    return shutdownPromise
  }

  // start http first so we know the port to publish in state.json
  const { server: httpServer, port } = await startHttpServer({
    frontendDir: FRONTEND_DIR,
    surface,
    session,
    bus,
    shutdown: reason => { void shutdown(reason) },
  })
  session.setPort(port)

  const ipcServer = await startIpcServer({
    socketPath: paths.sock,
    onCommand: async (cmd: CommandPayload): Promise<CommandResponse> => {
      switch (cmd.op) {
        case 'ping':
          return { ok: true, data: { sessionId, port } }
        case 'status':
          return { ok: true, data: session.snapshot() }
        case 'stop':
          setImmediate(() => { void shutdown('stop-command') })
          return { ok: true, data: { stopping: true } }
        case 'result':
          try {
            return { ok: true, data: session.buildResult() }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return { ok: false, error: message }
          }
        case 'reply':
          return { ok: false, error: 'command "reply" deferred to v0.3 (ask-agent threads)' }
        default: {
          const exhaustive: never = cmd
          return { ok: false, error: `unknown command: ${JSON.stringify(exhaustive)}` }
        }
      }
    },
    onWatch: socket => {
      return bus.subscribe(event => {
        try {
          socket.write(encodeFrame(event))
        } catch {
          // socket closed / errored — fan-out will clean up via socket close handler
        }
      }, { watchFilter: true })
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
