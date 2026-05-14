import type { ClientErrorInput } from '../../shared/client-errors.ts'

// Track which error messages have already been reported this session so a
// render-loop bug doesn't hammer the daemon. The cap matches the daemon's
// MAX_CLIENT_ERRORS (50) but here it's just a dedupe set.
const reported = new Set<string>()

export const reportClientError = (input: ClientErrorInput): void => {
  const key = `${input.source}::${input.message}`
  if (reported.has(key)) return
  reported.add(key)

  // Fire-and-forget. If the daemon is gone, we have no recovery anyway.
  fetch('/api/client-errors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  }).catch(() => {
    // Drop — we can't surface a report-of-the-report error.
  })
}

// Wire up the global handlers. Idempotent — safe to call multiple times.
let installed = false
export const installGlobalErrorReporting = (): void => {
  if (installed) return
  installed = true

  window.addEventListener('error', (ev: ErrorEvent) => {
    reportClientError({
      source: 'window-error',
      message: ev.message ?? 'unknown error',
      fileName: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
      stack: ev.error instanceof Error ? ev.error.stack : undefined,
    })
  })

  window.addEventListener('unhandledrejection', (ev: PromiseRejectionEvent) => {
    const reason = ev.reason
    reportClientError({
      source: 'unhandled-rejection',
      message: reason instanceof Error ? reason.message : String(reason ?? 'unknown rejection'),
      stack: reason instanceof Error ? reason.stack : undefined,
    })
  })
}
