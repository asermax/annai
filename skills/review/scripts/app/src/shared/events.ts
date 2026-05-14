/**
 * Event kinds emitted on the daemon's internal event bus.
 * The `EMITTED_ON_WATCH` subset is what `annai watch` forwards to the agent;
 * everything else is browser-only / state-only.
 *
 * In v0.1 only `session-started` and `session-aborted` actually fire — the
 * rest are wired into the filter so v0.2 just has to start emitting them.
 */

export const EVENT_KINDS = {
  'session-started': 'session-started',
  'comment-drafted': 'comment-drafted',
  'comment-edited': 'comment-edited',
  'comment-dismissed': 'comment-dismissed',
  'suggestion-accepted': 'suggestion-accepted',
  'agent-asked': 'agent-asked',
  'agent-thread-closed': 'agent-thread-closed',
  'decision-set': 'decision-set',
  'review-submitted': 'review-submitted',
  'session-aborted': 'session-aborted',
  'daemon-error': 'daemon-error',
} as const
export type EventKind = typeof EVENT_KINDS[keyof typeof EVENT_KINDS]

export const EMITTED_ON_WATCH: ReadonlySet<EventKind> = new Set<EventKind>([
  'agent-asked',
  'review-submitted',
  'session-aborted',
  'daemon-error',
])

export interface EventBase {
  kind: EventKind
  at: string // ISO timestamp
}

export interface SessionStartedEvent extends EventBase {
  kind: 'session-started'
  sessionId: string
  port: number
}

export interface AgentAskedEvent extends EventBase {
  kind: 'agent-asked'
  threadId: string
  context: {
    file: string
    lineRange: [number, number]
    surrounding?: string
  }
  question: string
}

export interface ReviewSubmittedEvent extends EventBase {
  kind: 'review-submitted'
  decision: 'approve' | 'comment'
  commentCount: number
}

export interface SessionAbortedEvent extends EventBase {
  kind: 'session-aborted'
  reason: string
}

export interface DaemonErrorEvent extends EventBase {
  kind: 'daemon-error'
  message: string
  recoverable: false
}

export type AnnaiEvent =
  | SessionStartedEvent
  | AgentAskedEvent
  | ReviewSubmittedEvent
  | SessionAbortedEvent
  | DaemonErrorEvent
  | (EventBase & { kind: Exclude<EventKind, SessionStartedEvent['kind'] | AgentAskedEvent['kind'] | ReviewSubmittedEvent['kind'] | SessionAbortedEvent['kind'] | DaemonErrorEvent['kind']> })
