import { join } from 'node:path'
import { tmpdir } from 'node:os'

export const getSessionsRoot = (): string => {
  const xdg = process.env.XDG_RUNTIME_DIR
  if (xdg != null && xdg.length > 0) {
    return join(xdg, 'annai', 'sessions')
  }

  const uid = typeof process.getuid === 'function' ? process.getuid() : 0
  const fallbackBase = process.env.TMPDIR ?? tmpdir()

  return join(fallbackBase, `annai-${uid}`, 'sessions')
}

export const getSessionDir = (sessionId: string): string => join(getSessionsRoot(), sessionId)

export const sessionPaths = (sessionId: string) => {
  const dir = getSessionDir(sessionId)

  return {
    dir,
    sock: join(dir, 'sock'),
    pid: join(dir, 'pid'),
    surface: join(dir, 'surface.json'),
    state: join(dir, 'state.json'),
    events: join(dir, 'events.log'),
    result: join(dir, 'result.json'),
  }
}
