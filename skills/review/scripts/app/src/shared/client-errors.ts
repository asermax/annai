import { z } from 'zod'

// Reports about client-side (browser) errors caught by the frontend's
// window.onerror / unhandledrejection listeners or React error boundary.
// The daemon stores up to MAX_CLIENT_ERRORS of these per session and emits
// each one as a `daemon-error` event on watch (source: 'client') so the
// agent can react without driving a browser itself.

export const MAX_CLIENT_ERRORS = 50

export const clientErrorInputSchema = z.object({
  message: z.string().min(1).max(4_000),
  source: z.enum(['window-error', 'unhandled-rejection', 'error-boundary']),
  stack: z.string().max(20_000).optional(),
  fileName: z.string().max(2_000).optional(),
  lineno: z.number().int().optional(),
  colno: z.number().int().optional(),
  componentStack: z.string().max(20_000).optional(),
})

export type ClientErrorInput = z.infer<typeof clientErrorInputSchema>

export interface ClientError extends ClientErrorInput {
  at: string // ISO timestamp set by the daemon on receipt
}
