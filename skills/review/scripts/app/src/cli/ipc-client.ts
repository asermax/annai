import { createConnection } from 'node:net'
import { encodeFrame, createFrameDecoder } from '../daemon/ipc.ts'
import type { CommandPayload, CommandResponse } from '../daemon/ipc.ts'

export const sendCommand = (socketPath: string, command: CommandPayload, timeoutMs = 5000): Promise<CommandResponse> => {
  return new Promise((resolveOuter, rejectOuter) => {
    const socket = createConnection(socketPath)
    const decoder = createFrameDecoder()

    const timer = setTimeout(() => {
      socket.destroy()
      rejectOuter(new Error(`ipc command "${command.op}" timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    socket.on('connect', () => {
      socket.write(encodeFrame({ kind: 'command', command }))
    })

    socket.on('data', chunk => {
      decoder.push(chunk)
      const frames = decoder.drain()
      if (frames.length === 0) return

      clearTimeout(timer)
      socket.end()
      resolveOuter(frames[0] as CommandResponse)
    })

    socket.on('error', err => {
      clearTimeout(timer)
      rejectOuter(err)
    })
  })
}
