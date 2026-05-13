import { describe, it, expect } from 'vitest'

import { encodeFrame, createFrameDecoder } from '../../src/daemon/ipc.ts'

describe('ipc frame codec', () => {
  it('round-trips a simple object', () => {
    const payload = { kind: 'command', command: { op: 'ping' } }
    const encoded = encodeFrame(payload)
    const decoder = createFrameDecoder()
    decoder.push(encoded)
    expect(decoder.drain()).toEqual([payload])
  })

  it('handles two frames in one chunk', () => {
    const a = { hello: 'world' }
    const b = { goodbye: 'world' }
    const encoded = Buffer.concat([encodeFrame(a), encodeFrame(b)])
    const decoder = createFrameDecoder()
    decoder.push(encoded)
    expect(decoder.drain()).toEqual([a, b])
  })

  it('handles a single frame split across chunks', () => {
    const payload = { ok: true, data: { snapshot: 'x' } }
    const encoded = encodeFrame(payload)
    const decoder = createFrameDecoder()
    decoder.push(encoded.subarray(0, 3))
    expect(decoder.drain()).toEqual([])
    decoder.push(encoded.subarray(3))
    expect(decoder.drain()).toEqual([payload])
  })
})
