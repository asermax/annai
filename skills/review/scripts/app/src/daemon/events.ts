import { EMITTED_ON_WATCH } from '../shared/events.ts'
import type { AnnaiEvent, EventKind } from '../shared/events.ts'

type Listener = (event: AnnaiEvent) => void

export interface SubscribeOptions {
  // When true, only events in EMITTED_ON_WATCH reach the listener.
  watchFilter?: boolean
}

export class EventBus {
  private listeners: Array<{ fn: Listener, watchFilter: boolean }> = []

  emit (event: AnnaiEvent): void {
    for (const { fn, watchFilter } of this.listeners) {
      if (watchFilter && !EMITTED_ON_WATCH.has(event.kind)) continue
      try {
        fn(event)
      } catch {
        // listeners must not throw out of the bus
      }
    }
  }

  subscribe (fn: Listener, opts: SubscribeOptions = {}): () => void {
    const entry = { fn, watchFilter: opts.watchFilter ?? false }
    this.listeners.push(entry)

    return () => {
      this.listeners = this.listeners.filter(other => other !== entry)
    }
  }
}

export const shouldEmitOnWatch = (kind: EventKind): boolean => EMITTED_ON_WATCH.has(kind)
