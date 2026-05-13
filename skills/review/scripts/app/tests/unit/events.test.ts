import { describe, it, expect } from 'vitest'

import { EventBus } from '../../src/daemon/events.ts'
import { EMITTED_ON_WATCH } from '../../src/shared/events.ts'
import type { AnnaiEvent } from '../../src/shared/events.ts'

describe('EventBus', () => {
  it('delivers to unfiltered subscribers regardless of kind', () => {
    const bus = new EventBus()
    const received: AnnaiEvent[] = []
    bus.subscribe(event => received.push(event))

    bus.emit({ kind: 'session-started', at: '2026-05-13T00:00:00Z', sessionId: 's', port: 1 })
    bus.emit({ kind: 'comment-drafted', at: '2026-05-13T00:00:01Z' })

    expect(received.map(e => e.kind)).toEqual(['session-started', 'comment-drafted'])
  })

  it('with watchFilter, only delivers EMITTED_ON_WATCH kinds', () => {
    const bus = new EventBus()
    const received: AnnaiEvent[] = []
    bus.subscribe(event => received.push(event), { watchFilter: true })

    bus.emit({ kind: 'comment-drafted', at: '1' })           // suppressed
    bus.emit({ kind: 'agent-asked', at: '2', threadId: 't', context: { file: 'f', lineRange: [1, 1] }, question: 'q' })
    bus.emit({ kind: 'decision-set', at: '3' })              // suppressed
    bus.emit({ kind: 'review-submitted', at: '4', decision: 'comment', commentCount: 0 })
    bus.emit({ kind: 'session-aborted', at: '5', reason: 'r' })
    bus.emit({ kind: 'daemon-error', at: '6', message: 'm', recoverable: false })

    expect(received.map(e => e.kind)).toEqual(['agent-asked', 'review-submitted', 'session-aborted', 'daemon-error'])
  })

  it('EMITTED_ON_WATCH stays the documented v0.2-ready set', () => {
    expect([...EMITTED_ON_WATCH].sort()).toEqual(['agent-asked', 'daemon-error', 'review-submitted', 'session-aborted'])
  })

  it('unsubscribe stops further deliveries', () => {
    const bus = new EventBus()
    const received: string[] = []
    const off = bus.subscribe(event => received.push(event.kind))
    bus.emit({ kind: 'session-started', at: '1', sessionId: 's', port: 1 })
    off()
    bus.emit({ kind: 'comment-drafted', at: '2' })
    expect(received).toEqual(['session-started'])
  })
})
