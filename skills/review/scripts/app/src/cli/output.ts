// Shared output helpers for the surface authoring CLI.
// Each handler builds a small payload describing what changed and calls
// `emitResult(...)` once on success. In default mode we print a single
// human-readable line; with `--json` we print a single JSON line. With
// `--quiet` we print nothing.

export interface ResultPayload {
  op: string
  surface?: string
  text: string
  data?: Record<string, unknown>
}

export interface OutputMode {
  json: boolean
  quiet: boolean
}

export const wantsHelp = (argv: readonly string[]): boolean => {
  return argv.some(a => a === '-h' || a === '--help')
}

export const emitResult = (payload: ResultPayload, mode: OutputMode): void => {
  if (mode.quiet) return

  if (mode.json) {
    const body = {
      ok: true,
      op: payload.op,
      ...(payload.surface != null ? { surface: payload.surface } : {}),
      ...(payload.data != null ? { result: payload.data } : {}),
    }
    process.stdout.write(JSON.stringify(body) + '\n')
    return
  }

  process.stdout.write(`annai: ${payload.text}\n`)
}

export const emitError = (op: string, message: string, mode: OutputMode): void => {
  if (mode.json) {
    process.stdout.write(JSON.stringify({ ok: false, op, error: { message } }) + '\n')
    return
  }
  process.stderr.write(`annai: ${message}\n`)
}
