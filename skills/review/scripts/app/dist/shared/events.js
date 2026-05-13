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
};
export const EMITTED_ON_WATCH = new Set([
    'agent-asked',
    'review-submitted',
    'session-aborted',
    'daemon-error',
]);
//# sourceMappingURL=events.js.map