import { createServer } from 'node:net'
import type { Server, Socket } from 'node:net'

/**
 * Length-prefixed JSON frames over a unix socket.
 *
 * Frame layout: 4-byte big-endian length, then UTF-8 JSON payload of that length.
 *
 * Two connection kinds (the client picks one in its first frame):
 *  - { kind: "command", command: { op: "ping" | "status" | "stop" } }
 *  - { kind: "watch" }
 *
 * In v0.1, only "command" connections do work. "watch" connections are
 * accepted (so the wire shape exists), but no events ever fire on them.
 */

export interface CommandRequest {
  kind: 'command'
  command: CommandPayload
}

export interface WatchRequest {
  kind: 'watch'
  // future: lastOffset for events.log replay
}

export type IpcRequest = CommandRequest | WatchRequest

export type CommandPayload =
  | { op: 'ping' }
  | { op: 'status' }
  | { op: 'stop' }
  | { op: 'reply', threadId: string, message: string }   // v0.2
  | { op: 'result' }                                       // v0.2

export interface CommandResponse {
  ok: boolean
  data?: unknown
  error?: string
}

export const encodeFrame = (payload: unknown): Buffer => {
  const body = Buffer.from(JSON.stringify(payload), 'utf8')
  const header = Buffer.alloc(4)
  header.writeUInt32BE(body.length, 0)

  return Buffer.concat([header, body])
}

export interface FrameDecoder {
  push: (chunk: Buffer) => void
  drain: () => unknown[]
}

export const createFrameDecoder = (): FrameDecoder => {
  let buffer = Buffer.alloc(0)
  const frames: unknown[] = []

  const tryConsume = (): boolean => {
    if (buffer.length < 4) return false
    const len = buffer.readUInt32BE(0)
    if (buffer.length < 4 + len) return false

    const body = buffer.subarray(4, 4 + len).toString('utf8')
    buffer = buffer.subarray(4 + len)
    frames.push(JSON.parse(body))

    return true
  }

  return {
    push: chunk => {
      buffer = Buffer.concat([buffer, chunk])
      while (tryConsume()) { /* keep consuming */ }
    },
    drain: () => {
      const out = frames.splice(0)
      return out
    },
  }
}

export type CommandHandler = (cmd: CommandPayload) => Promise<CommandResponse> | CommandResponse
export type WatchHandler = (socket: Socket) => () => void  // returns unsubscribe

export interface StartIpcServerOptions {
  socketPath: string
  onCommand: CommandHandler
  onWatch?: WatchHandler
}

export const startIpcServer = (opts: StartIpcServerOptions): Promise<Server> => {
  const { socketPath, onCommand, onWatch } = opts

  const server = createServer(socket => {
    const decoder = createFrameDecoder()
    let unsubscribeWatch: (() => void) | null = null

    socket.on('data', chunk => {
      decoder.push(chunk)
      const frames = decoder.drain()
      if (frames.length === 0) return

      // We only ever look at the first frame to identify the connection kind.
      const first = frames[0] as IpcRequest

      if (first.kind === 'command') {
        const cmd = first.command
        Promise.resolve(onCommand(cmd))
          .then(response => {
            socket.write(encodeFrame(response))
            socket.end()
          })
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : String(err)
            socket.write(encodeFrame({ ok: false, error: message } satisfies CommandResponse))
            socket.end()
          })
        return
      }

      if (first.kind === 'watch') {
        if (onWatch == null) {
          socket.write(encodeFrame({ ok: false, error: 'watch not supported' } satisfies CommandResponse))
          socket.end()
          return
        }
        unsubscribeWatch = onWatch(socket)
        return
      }

      socket.write(encodeFrame({ ok: false, error: 'unknown frame kind' } satisfies CommandResponse))
      socket.end()
    })

    socket.on('close', () => {
      if (unsubscribeWatch != null) unsubscribeWatch()
    })

    socket.on('error', () => {
      if (unsubscribeWatch != null) unsubscribeWatch()
    })
  })

  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(socketPath, () => {
      server.off('error', rejectListen)
      resolveListen(server)
    })
  })
}
